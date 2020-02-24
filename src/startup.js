'use strict';

const
	q = require('q'),
	logger = require('./lib/bunyan').logger,
	express = require('./lib/express'),
	mongoose = require('./lib/mongoose');


module.exports = function () {
	logger.info('Starting initialization of Node.js server');

	// Initialize mongoose
	return mongoose.connect()
		.then((db) => {
			try {
				logger.info('Mongoose connected, proceeding with application configuration');

				// Initialize express
				const app = express.init(db.admin);

				// Init task scheduler
				const scheduler = require('./scheduler');
				scheduler.start();

				// Init dispatcher
				const dispatcher = require('./dispatcher');
				dispatcher.start();

				return app;

			} catch (err) {
				logger.fatal('Express initialization failed.');
				return q.reject(err);
			}
		});
};
