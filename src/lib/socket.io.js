'use strict';

const path = require('path'),
	cookieParser = require('cookie-parser'),
	passport = require('passport'),
	socketio = require('socket.io'),
	expressSession = require('express-session'),
	MongoStore = require('connect-mongo')(expressSession),
	config = require('../config'),
	logger = require('./bunyan.js').logger;

/**
 * Controllers created outside of this class will register
 * themselves as socket listeners, with function definitions
 * stored here.
 */
const registeredSocketListeners = [];

// Give each socket connection its own variable scope
function onConnect(socket) {
	logger.debug('SocketIO: New client connection');

	/**
	 * Setup Socket Event Handlers
	 */
	registeredSocketListeners.forEach((S) => {
		new S({ socket: socket });
	});
}

/**
 * Configure the modules sockets by simply including the files.
 * Do not instantiate the modules.
 */
function initModulesServerSockets() {
	// Globbing socket files
	config.files.sockets.forEach((socketPath) => {
		require(path.posix.resolve(socketPath));
	});
}

/**
 * Define the Socket.io configuration method
 *
 * @param {import('http').Server} server
 * @param db
 */
module.exports.init = (server, db) => {
	// Initialize modules sockets
	initModulesServerSockets();

	// Create a new Socket.io server
	logger.info('Creating SocketIO Server');
	const io = socketio.listen(server);

	// Create a MongoDB storage object
	const mongoStore = new MongoStore({
		mongooseConnection: db.connection,
		collection: config.auth.sessionCollection
	});

	// Intercept Socket.io's handshake request
	io.use((socket, next) => {
		// Use the 'cookie-parser' module to parse the request cookies
		cookieParser(config.auth.sessionSecret)(socket.request, {}, () => {
			// Get the session id from the request cookies
			const sessionId = socket.request.signedCookies['connect.sid'];

			// Use the mongoStorage instance to get the Express session information
			mongoStore.get(sessionId, (err, session) => {
				// Set the Socket.io session information
				socket.request.session = session;

				// Use Passport to populate the user details
				// @ts-ignore
				passport.initialize()(socket.request, {}, () => {
					passport.session()(socket.request, {}, () => {
						if (socket.request.user) {
							logger.debug(
								'SocketIO: New authenticated user: %s',
								socket.request.user.username
							);
							return next(null);
						}
						logger.info(
							'SocketIO: Unauthenticated user attempting to connect.'
						);
						return next(new Error('User is not authenticated'));
					});
				});
			});
		});
	});

	// Add an event listener to the 'connection' event
	io.on('connection', onConnect);
};

/*
 * App-specific function to register controllers that will be
 * sent the socket
 */
module.exports.registerSocketListener = (s) => {
	let name = s;
	if (null != s.prototype.name) {
		name = s.prototype.name;
	}

	logger.info('Registering Socket Listener: %s', name);
	registeredSocketListeners.push(s);
};
