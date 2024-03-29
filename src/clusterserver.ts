'use strict';

import config from 'config';
import sticky from 'socketio-sticky-session';

import { logger } from './lib/logger';
import startupFn from './startup';

const defaultOptions = {
	proxy: true, //activate layer 4 patching
	ignoreMissingHeader: true, //will proxy even if the header is missing in a request
	header: 'x-forwarded-for', //provide here your header containing the users ip
	num: parseInt(process.env.NODE_WORKERS) || 2 //count of processes to create, defaults to maximum if omitted
};

const options = config.get('clusterConfig') || defaultOptions;
logger.info(`Cluster config: ${JSON.stringify(options)}`);

startupFn()
	.then((app) => {
		sticky(options, () => app).listen(config.get('port'), () => {
			logger.info(`server started on ${config.get('port')} port`);
		});
	})
	.catch((error) => {
		logger.error(error, 'Startup initialization failed.');
	});
