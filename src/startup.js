'use strict';

const logger = require('./lib/bunyan').logger,
	http = require('http'),
	express = require('./lib/express'),
	mongoose = require('./lib/mongoose'),
	socketio = require('./lib/socket.io');

/**
 * @returns {Promise<http.Server>}
 */
module.exports = function () {
	logger.info('Starting initialization of Node.js server');

	// Initialize mongoose
	return mongoose.connect()
		.then((db) => {
			try {
				logger.info('Mongoose connected, proceeding with application configuration');

				// Initialize express
				const app = express.init(db.admin);

				// Create a new HTTP server
				logger.info('Creating HTTP Server');
				const server = http.createServer(app);

				// Initialize socket.io
				socketio.init(server, db.admin);

				// Init task scheduler
				const scheduler = require('./scheduler');
				scheduler.start();

				// Init dispatcher
				const dispatcher = require('./dispatcher');
				dispatcher.start();

				return server;
			} catch (err) {
				logger.fatal('Express initialization failed.');
				return Promise.reject(err);
			}
		});
};
