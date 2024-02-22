import path from 'path';

import compress from 'compression';
import config from 'config';
import flash from 'connect-flash';
import connect_mongo from 'connect-mongo';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express, Request, Response } from 'express';
// Patches express to support async/await.  Should be called immediately after express.
// Must still use require vs. import
require('express-async-errors');
import actuator from 'express-actuator';
import session from 'express-session';
import { glob, globSync } from 'glob';
import helmet from 'helmet';
import { StatusCodes } from 'http-status-codes';
import _ from 'lodash';
import methodOverride from 'method-override';
import { Mongoose } from 'mongoose';
import morgan from 'morgan';
import passport from 'passport';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import { logger } from './bunyan';
import {
	defaultErrorHandler,
	jsonSchemaValidationErrorHandler,
	mongooseValidationErrorHandler
} from '../app/common/express/error-handlers';

const MongoStore = connect_mongo(session);

const baseApiPath = '/api';

/**
 * Initialize application middleware
 */
function initMiddleware(app: Express) {
	// Showing stack errors
	app.set('showStackError', true);

	// Should be placed before express.static
	app.use(
		compress({
			filter: function (req: Request, res: Response) {
				if (req.headers['x-no-compression']) {
					// don't compress responses with this request header
					return false;
				}

				// fallback to standard filter function
				return compress.filter(req, res);
			},
			level: 6
		})
	);

	// Environment dependent middleware
	if (config.get<string>('mode') === 'development') {
		// Disable views cache
		app.set('view cache', false);
	} else if (config.get<string>('mode') === 'production') {
		app.locals.cache = 'memory';
	}

	// Optionally turn on express logging
	if (config.get<boolean>('expressLogging')) {
		app.use(morgan('dev'));
	}

	// Request body parsing middleware should be above methodOverride
	app.use(
		express.urlencoded({
			extended: true
		})
	);
	app.use(express.json());
	app.use(methodOverride());

	// Add the cookie parser and flash middleware
	app.use(cookieParser(config.get<string>('auth.sessionSecret')));
	app.use(flash());
}

/**
 * Configure view engine
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function initViewEngine(app: Express) {
	// Not using server rendering for views
}

/**
 * Configure Express session
 */
function initSession(app: Express, db: Mongoose) {
	// Express MongoDB session storage
	app.use(
		session({
			saveUninitialized: true,
			resave: true,
			secret: config.get<string>('auth.sessionSecret'),
			cookie: config.get<string>('auth.sessionCookie'),
			store: new MongoStore({
				mongooseConnection: db.connection,
				collection: config.get<string>('auth.sessionCollection')
			})
		})
	);
}

/**
 * Configure passport
 */
async function initPassport(app: Express) {
	app.use(passport.initialize());
	app.use(passport.session());

	await import('./passport').then((p) => p.init());
}

/**
 * Invoke modules server configuration
 */
async function initModulesConfiguration(app: Express, db: Mongoose) {
	const configPaths = await glob(config.get<string[]>('assets.config'));

	const moduleConfigs = await Promise.all(
		configPaths.map((configPath) => import(path.posix.resolve(configPath)))
	);
	moduleConfigs.forEach((moduleConfig) => {
		moduleConfig.default(app, db);
	});
}

/**
 * Configure Helmet headers configuration
 */
function initHelmetHeaders(app: Express) {
	// Use helmet to secure Express headers
	app.use(helmet.frameguard());
	app.use(helmet.xssFilter());
	app.use(helmet.noSniff());
	app.use(helmet.ieNoOpen());
	app.disable('x-powered-by');
}

function initCORS(app: Express) {
	if (config.get<boolean>('cors.enabled') !== true) {
		return;
	}
	app.use(cors({ ...config.get<Record<string, unknown>>('cors.options') }));
}

/**
 * Configure the modules server routes
 */
async function initModulesServerRoutes(app: Express) {
	// Init the global route prefix
	const router = express.Router();

	const routePaths = await glob(config.get<string[]>('assets.routes'));
	const routes = await Promise.all(
		routePaths.map((routePath: string) => import(path.posix.resolve(routePath)))
	);
	routes.forEach((route) => {
		router.use(route.default);
	});

	// Host everything behind a single endpoint
	app.use(baseApiPath, router);
}

/**
 * Configure final error handlers
 */
function initErrorRoutes(app: Express) {
	app.use(jsonSchemaValidationErrorHandler);
	app.use(mongooseValidationErrorHandler);
	app.use(defaultErrorHandler);

	// Assume 404 since no middleware responded
	app.use((req, res) => {
		// Send 404 with error message
		res.status(StatusCodes.NOT_FOUND).json({
			status: StatusCodes.NOT_FOUND,
			type: 'not-found',
			message: 'The resource was not found'
		});
	});
}

function initActuator(app: Express) {
	// actuator must be enabled explicitly in the config
	if (config.get<boolean>('actuator.enabled') !== true) {
		return;
	}
	logger.info('Configuring actuator endpoints');
	app.use(actuator(config.get<Record<string, unknown>>('actuator.options')));
}

function initSwaggerAPI(app: Express) {
	// apiDocs must be enabled explicitly in the config
	if (config.get<boolean>('apiDocs.enabled') !== true) {
		return;
	}

	logger.info('Configuring api docs');

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const swaggerOptions: any = {
		swaggerDefinition: {
			openapi: '3.0.2',
			info: {
				title: config.get<string>('app.title'),
				description: config.get<string>('app.description'),
				contact: {
					email: config.get<string>('mailer.from')
				}
			},
			servers: [
				{
					url: baseApiPath
				}
			],
			components: {}
		},
		apis: [
			...globSync(config.get<string[]>('assets.docs')).map((doc: string) =>
				path.posix.resolve(doc)
			),
			...globSync(config.get<string[]>('assets.routes')).map((route: string) =>
				path.posix.resolve(route)
			),
			...globSync(config.get<string[]>('assets.models')).map((model: string) =>
				path.posix.resolve(model)
			)
		]
	};

	if (config.get<string>('auth.strategy') === 'local') {
		swaggerOptions.swaggerDefinition.components.securitySchemes = {
			basicAuth: {
				type: 'http',
				scheme: 'basic'
			}
		};
	}

	const swaggerSpec = swaggerJsDoc(swaggerOptions);

	/*
	 * Some api calls are dependent on whether local or proxy-pki are used.
	 * If no strategy is defined, assume it is used in both.
	 */
	swaggerSpec.paths = _.pickBy(swaggerSpec.paths, (_path) => {
		return (
			_path.strategy === undefined ||
			_path.strategy === config.get<string>('auth.strategy')
		);
	});

	const uiOptions = {
		filter: true,
		...config.get<Record<string, unknown>>('apiDocs.uiOptions')
	};

	app.use(
		config.get<string>('apiDocs.path'),
		swaggerUi.serve,
		swaggerUi.setup(swaggerSpec, null, uiOptions)
	);

	app.get(config.get<string>('apiDocs.jsonPath'), (req, res) => {
		res.send(swaggerSpec);
	});
}

/**
 * Initialize the Express application
 */
export const init = async (db: Mongoose): Promise<Express> => {
	// Initialize express app
	logger.info('Initializing Express');

	const app: Express = express();

	// Initialize Express middleware
	initMiddleware(app);

	// Initialize Express view engine
	initViewEngine(app);

	// Initialize Express session
	initSession(app, db);

	// Initialize passport auth
	await initPassport(app);

	// Initialize Modules configuration
	await initModulesConfiguration(app, db);

	// Initialize Helmet security headers
	initHelmetHeaders(app);

	// Initialize CORS headers
	initCORS(app);

	// Initialize modules server routes
	await initModulesServerRoutes(app);

	// Initialize Swagger API
	initSwaggerAPI(app);

	// Initialize Actuator routes
	initActuator(app);

	// Initialize error routes
	initErrorRoutes(app);

	return app;
};
