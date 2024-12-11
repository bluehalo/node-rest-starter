import path from 'path';

import fastifyCompress from '@fastify/compress';
import { fastifyCookie } from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyFormbody from '@fastify/formbody';
import fastifyHelmet from '@fastify/helmet';
import { Authenticator } from '@fastify/passport';
import fastifySession from '@fastify/session';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import config from 'config';
import MongoStore from 'connect-mongo';
import { fastify, FastifyInstance } from 'fastify';
import { glob } from 'glob';
import { Mongoose } from 'mongoose';

import { logger as baseLogger } from './logger';
import pkg from '../../package.json';
import fastifyActuator from '../app/common/fastify/actuator';

const logger = baseLogger.child({ component: 'fastify' });

const baseApiPath = '/api';

export async function init(db: Mongoose) {
	const app = fastify({
		logger: config.get('fastifyLogging')
	});

	// Configure compression
	await app.register(fastifyCompress);

	// Configure parser for `application/x-www-form-urlencoded` content
	await app.register(fastifyFormbody);

	// Configure authentication with session/passport
	await initSession(app, db);

	// Configure Helmet security headers
	app.register(fastifyHelmet, {
		frameguard: true,
		xssFilter: true,
		noSniff: true,
		ieNoOpen: true,
		hidePoweredBy: true
	});

	// Configure CORS
	if (config.get<boolean>('cors.enabled') === true) {
		app.register(fastifyCors, {
			...config.get<Record<string, unknown>>('cors.options')
		});
	}

	initSwaggerAPI(app);

	initActuator(app);

	await initModulesServerRoutes(app);

	app.setErrorHandler((error, request) => {
		logger.error({
			message: error.message,
			stack: error.stack,
			req: { method: request.method, url: request.url, host: request.host }
		});
		throw error;
	});

	return app;
}

async function initSession(app: FastifyInstance, db: Mongoose) {
	// setup an Authenticator instance which uses @fastify/session
	const fastifyPassport = new Authenticator();

	app.register(fastifyCookie);
	app.register(fastifySession, {
		secret: config.get('auth.sessionSecret'),
		cookie: {
			secure: false
			// maxAge: config.get<number>('auth.sessionCookie')
		},
		store: MongoStore.create({
			client: db.connection.getClient(),
			collectionName: config.get<string>('auth.sessionCollection')
		} as unknown)
	});

	// initialize @fastify/passport and connect it to the secure-session storage. Note: both of these plugins are mandatory.
	app.register(fastifyPassport.initialize());
	app.register(fastifyPassport.secureSession());

	await import('./passport').then((p) => p.initFastify(fastifyPassport));
}

/**
 * Configure the modules server routes
 */
async function initModulesServerRoutes(app: FastifyInstance) {
	// Init the global route prefix

	const controllerPaths = await glob(
		config.get<string[]>('assets.controllers')
	);
	logger.info(`Registering ${controllerPaths.length} controllers`);

	await Promise.all(
		controllerPaths.map(async (controllerPath: string) => {
			const controller = await import(path.posix.resolve(controllerPath));
			if (controller.default) {
				logger.debug(`Registering controller: ${controllerPath}`);
				app.register(controller.default, { prefix: baseApiPath });
			}
		})
	);
}

function initSwaggerAPI(app: FastifyInstance) {
	// apiDocs must be enabled explicitly in the config
	if (config.get<boolean>('apiDocs.enabled') !== true) {
		return;
	}

	logger.info('Configuring api docs');

	app.register(fastifySwagger, {
		openapi: {
			openapi: '3.0.2',
			info: {
				title: config.get<string>('app.title'),
				description: config.get<string>('app.description'),
				contact: {
					email: config.get<string>('mailer.from')
				},
				version: pkg.version
			}
		}
	});
	app.register(fastifySwaggerUi, {
		routePrefix: config.get<string>('apiDocs.path'),
		uiConfig: config.get<Record<string, unknown>>('apiDocs.uiOptions')
	});
}

function initActuator(app: FastifyInstance) {
	// actuator must be enabled explicitly in the config
	if (config.get<boolean>('actuator.enabled') !== true) {
		return;
	}

	logger.info('Configuring actuator endpoints');

	const basePath = config.get<string>('actuator.options.basePath');
	app.register(fastifyActuator, {
		prefix: basePath
	});
}
