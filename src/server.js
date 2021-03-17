'use strict';

const
	config = require('./config'),
	startupPromise = require('./startup')(),
	logger = require('./lib/bunyan').logger;

startupPromise
	.then((server) => {
		// Start the app
		server.listen(config.port);
		logger.info(`${config.app.instanceName} started on port ${config.port}`);
	}).catch((error) => {
		logger.fatal(error, 'Startup initialization failed.');
	});
