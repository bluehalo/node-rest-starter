'use strict';

const express = require('express');
// Patches express to support async/await.  Should be called immediately after express.
require('express-async-errors');

const _ = require('lodash'),
	path = require('path'),
	config = require('../config'),
	logger = require('./bunyan').logger,
	bodyParser = require('body-parser'),
	compress = require('compression'),
	cookieParser = require('cookie-parser'),
	session = require('express-session'),
	flash = require('connect-flash'),
	helmet = require('helmet'),
	methodOverride = require('method-override'),
	morgan = require('morgan'),
	passport = require('passport'),
	swaggerJsDoc = require('swagger-jsdoc'),
	swaggerUi = require('swagger-ui-express'),
	MongoStore = require('connect-mongo')(session),
	errorHandlers = require('../app/common/express/error-handlers');

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
		bodyParser.urlencoded({
			extended: true
		})
	);
	app.use(bodyParser.json());
	app.use(methodOverride());

	// Add the cookie parser and flash middleware
	app.use(cookieParser(config.auth.sessionSecret));
	app.use(flash());
}

/**
 * Configure view engine
 */
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
function initPassport(app) {
	app.use(passport.initialize());
	app.use(passport.session());

	require('./passport').init();
}

/**
 * Invoke modules server configuration
 */
function initModulesConfiguration(app, db) {
	config.files.configs.forEach((configPath) => {
		require(path.posix.resolve(configPath))(app, db);
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

/**
 * Configure the modules server routes
 */
function initModulesServerRoutes(app) {
	// Init the global route prefix
	const router = express.Router();

	// Use all routes
	config.files.routes.forEach((routePath) => {
		router.use(require(path.posix.resolve(routePath)));
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

	const swaggerOptions = {
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
			]
		},
		apis: [
			...config.files.docs.map((doc) => path.posix.resolve(doc)),
			...config.files.routes.map((route) => path.posix.resolve(route)),
			...config.files.models.map((model) => path.posix.resolve(model))
		]
	};

	if (config.auth.strategy === 'local') {
		swaggerOptions.swaggerDefinition.components =
			swaggerOptions.swaggerDefinition.components || {};
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
 *
 * @returns {express.Express}
 */
module.exports.init = function (db) {
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
	initPassport(app);

	// Initialize Modules configuration
	initModulesConfiguration(app);

	// Initialize Helmet security headers
	initHelmetHeaders(app);

	// Initialize modules server routes
	initModulesServerRoutes(app);

	// Initialize Swagger API
	initSwaggerAPI(app);

	// Initialize error routes
	initErrorRoutes(app);

	return app;
};
