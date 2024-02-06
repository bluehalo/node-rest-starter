import config from 'config';

import { logger } from './lib/bunyan';
import startupFn from './startup';

startupFn()
	.then((server) => {
		// Start the app
		server.listen(config.get('port'));
		logger.info(
			`${config.get('app.instanceName')} started on port ${config.get('port')}`
		);
	})
	.catch((error) => {
		logger.fatal(error, 'Startup initialization failed.');
		// non-zero exit code to let the process know that we've failed
		process.exit(1);
	});
