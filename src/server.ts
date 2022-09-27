import config from './config';
import { logger } from './lib/bunyan';
import startupFn from './startup';

startupFn()
	.then((server) => {
		// Start the app
		server.listen(config.port);
		logger.info(`${config.app.instanceName} started on port ${config.port}`);
	})
	.catch((error) => {
		logger.fatal(error, 'Startup initialization failed.');
	});
