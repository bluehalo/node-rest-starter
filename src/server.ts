import config from './config';
import startupFn from './startup';
import { logger } from './lib/bunyan';

startupFn()
	.then((server) => {
		// Start the app
		server.listen(config.port);
		logger.info(`${config.app.instanceName} started on port ${config.port}`);
	})
	.catch((error) => {
		logger.fatal(error, 'Startup initialization failed.');
	});
