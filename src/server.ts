import config from 'config';

import { logger } from './lib/logger';
import startupFn from './startup';

startupFn()
	.then((server) => {
		// Start the app
		server.listen({
			port: config.get<number>('port'),
			host: config.get<string>('host')
		});
		logger.info(
			`${config.get('app.instanceName')} started on port ${config.get('port')}`
		);
	})
	.catch((error) => {
		logger.error('Startup initialization failed.', error);
		// non-zero exit code to let the process know that we've failed
		process.exit(1);
	});
