import http from 'http';
import path from 'path';

import config from 'config';
import connect_mongo from 'connect-mongo';
import cookieParser from 'cookie-parser';
import expressSession from 'express-session';
import { glob } from 'glob';
import { Mongoose } from 'mongoose';
import passport from 'passport';
import { Server, Socket } from 'socket.io';

import { logger } from './bunyan';
import {
	BaseSocket,
	BaseSocketSubclass
} from '../app/common/sockets/base-socket.provider';

const MongoStore = connect_mongo(expressSession);

/**
 * Adapt express middleware to work with Socket.IO
 */
function expressToIO(expressMiddleware) {
	return (socket, next) =>
		expressMiddleware(socket.request, socket.request.res, next);
}

class SocketIo {
	/**
	 * Controllers created outside this class will register
	 * themselves as socket listeners, with function definitions
	 * stored here.
	 */
	registeredSocketListeners: BaseSocketSubclass[] = [];

	SocketProvider: typeof BaseSocket;

	onConnect(socket: Socket) {
		logger.debug('SocketIO: New client connection');

		/**
		 * Setup Socket Event Handlers
		 */
		this.registeredSocketListeners.forEach((SocketListener) => {
			new SocketListener(socket, {});
		});
	}

	/**
	 * Configure the modules sockets by simply including the files.
	 * Do not instantiate the modules.
	 */
	async initModulesServerSockets() {
		const socketPaths = await glob(config.get<string[]>('assets.sockets'));
		// Globbing socket files
		for (const socketPath of socketPaths) {
			// eslint-disable-next-line no-await-in-loop
			await import(path.posix.resolve(socketPath));
		}
	}

	async loadSocketProvider() {
		this.SocketProvider = (
			await import(path.posix.resolve(config.get('socketProvider')))
		).default;
	}

	/**
	 * Define the Socket.io configuration method
	 */
	async init(server: http.Server, db: Mongoose) {
		// Load configured Socket Provider implementation
		await this.loadSocketProvider();

		// Initialize modules sockets
		await this.initModulesServerSockets();

		// Create a new Socket.io server
		logger.info('Creating SocketIO Server');
		const io = new Server(server, {
			allowEIO3: true // @FIXME: Set to true for client compatibility. Fix when UI is updated.
		});

		io.use(expressToIO(cookieParser(config.get('auth.sessionSecret'))));
		io.use(
			expressToIO(
				expressSession({
					saveUninitialized: true,
					resave: true,
					secret: config.get('auth.sessionSecret'),
					cookie: config.get('auth.sessionCookie'),
					store: new MongoStore({
						mongooseConnection: db.connection,
						collection: config.get('auth.sessionCollection')
					})
				})
			)
		);
		io.use(expressToIO(passport.initialize()));
		io.use(expressToIO(passport.session()));

		// Verify if user was found in session
		io.use((socket, next) => {
			if (socket.request['user']) {
				logger.debug(
					'SocketIO: New authenticated user: %s',
					socket.request['user'].username
				);
				return next(null);
			}
			logger.info('SocketIO: Unauthenticated user attempting to connect.');
			return next(new Error('User is not authenticated'));
		});

		// Add an event listener to the 'connection' event
		io.on('connection', (socket) => this.onConnect(socket));
	}

	/*
	 * App-specific function to register controllers that will be
	 * sent the socket
	 */
	registerSocketListener(s: BaseSocketSubclass) {
		logger.info('Registering Socket Listener: %s', s.name);
		this.registeredSocketListeners.push(s);
	}
}

export = new SocketIo();
