import path from 'path';

import compress from 'compression';
import flash from 'connect-flash';
import connect_mongo from 'connect-mongo';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
// Patches express to support async/await.  Should be called immediately after express.
// Must still use require vs. import
require('express-async-errors');
import session from 'express-session';
import helmet from 'helmet';
import _ from 'lodash';
import methodOverride from 'method-override';
import morgan from 'morgan';
import passport from 'passport';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import * as errorHandlers from '../app/common/express/error-handlers';
import config from '../config';
import { logger } from './bunyan';

const MongoStore = connect_mongo(session);

const baseApiPath = '/api';

/**
 * Initialize local variables
 */
function initLocalVariables(app) {
	// Setting application local variables
	app.locals.title = config.app.title;
	app.locals.description = config.app.description;
	app.locals.keywords = config.app.keywords;

	// Development
	app.locals.developmentMode = config.mode === 'development';

	// Passing the request url to environment locals
	app.use((req, res, next) => {
		res.locals.host = config.app.serverUrlWithoutPort;
		res.locals.url = config.app.clientUrl + req.originalUrl;
		next();
	});
}

/**
 * Initialize application middleware
 */
function initMiddleware(app) {
	// Showing stack errors
	app.set('showStackError', true);

	// Should be placed before express.static
	app.use(
		compress({
			filter: function (req, res) {
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
	if (config.mode === 'development') {
		// Disable views cache
		app.set('view cache', false);
	} else if (config.mode === 'production') {
		app.locals.cache = 'memory';
	}

	// Optionally turn on express logging
	if (config.expressLogging) {
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
	app.use(cookieParser(config.auth.sessionSecret));
	app.use(flash());
}

/**
 * Configure view engine
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function initViewEngine(app) {
	// Not using server rendering for views
}

/**
 * Configure Express session
 */
function initSession(app, db) {
	// Express MongoDB session storage
	app.use(
		session({
			saveUninitialized: true,
			resave: true,
			secret: config.auth.sessionSecret,
			cookie: config.auth.sessionCookie,
			store: new MongoStore({
				mongooseConnection: db.connection,
				collection: config.auth.sessionCollection
			})
		})
	);
}

/**
 * Configure passport
 */
async function initPassport(app) {
	app.use(passport.initialize());
	app.use(passport.session());

	await import('./passport').then((p) => p.init());
}

/**
 * Invoke modules server configuration
 */
async function initModulesConfiguration(app, db) {
	const moduleConfigs = await Promise.all(
		config.files.configs.map(
			(configPath) => import(path.posix.resolve(configPath))
		)
	);
	moduleConfigs.forEach((moduleConfig) => {
		moduleConfig.default(app, db);
	});
}

/**
 * Configure Helmet headers configuration
 */
function initHelmetHeaders(app) {
	// Use helmet to secure Express headers
	app.use(helmet.frameguard());
	app.use(helmet.xssFilter());
	app.use(helmet.noSniff());
	app.use(helmet.ieNoOpen());
	app.disable('x-powered-by');
}

function initCORS(app) {
	if (config.cors?.enabled) {
		app.use(cors({ ...config.cors.options }));
	}
}

/**
 * Configure the modules server routes
 */
async function initModulesServerRoutes(app) {
	// Init the global route prefix
	const router = express.Router();

	const routes = await Promise.all(
		config.files.routes.map(
			(routePath) => import(path.posix.resolve(routePath))
		)
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
function initErrorRoutes(app) {
	app.use(errorHandlers.jsonSchemaValidationErrorHandler);
	app.use(errorHandlers.mongooseValidationErrorHandler);
	app.use(errorHandlers.defaultErrorHandler);

	// Assume 404 since no middleware responded
	app.use((req, res) => {
		// Send 404 with error message
		res.status(404).json({
			status: 404,
			type: 'not-found',
			message: 'The resource was not found'
		});
	});
}

function initSwaggerAPI(app) {
	if (!config.apiDocs || config.apiDocs.enabled !== true) {
		// apiDocs must be enabled explicitly in the config
		return;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const swaggerOptions: any = {
		swaggerDefinition: {
			openapi: '3.0.2',
			info: {
				title: config.app.title,
				description: config.app.description,
				contact: {
					email: config.mailer?.from
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
			...config.files.docs.map((doc) => path.posix.resolve(doc)),
			...config.files.routes.map((route) => path.posix.resolve(route)),
			...config.files.models.map((model) => path.posix.resolve(model))
		]
	};

	if (config.auth.strategy === 'local') {
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
			_path.strategy === undefined || _path.strategy === config.auth.strategy
		);
	});

	const uiOptions = {
		filter: true,
		...config.apiDocs.uiOptions
	};

	app.use(
		config.apiDocs.path || '/api-docs',
		swaggerUi.serve,
		swaggerUi.setup(swaggerSpec, null, uiOptions)
	);
}

/**
 * Initialize the Express application
 */
export const init = async (db): Promise<express.Express> => {
	// Initialize express app
	logger.info('Initializing Express');

	/**
	 * @type {express.Express}
	 */
	const app = express();

	// Initialize local variables
	initLocalVariables(app);

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

	// Initialize error routes
	initErrorRoutes(app);

	return app;
};
