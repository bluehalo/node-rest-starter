'use strict';

const path = require('path'),
	deps = require('./dependencies'),
	config = deps.config,
	logger = deps.logger;

/*
 * Services are configured in the application configuration
 * Each service has a config object that looks like the following:
 * {
 * 		interval: 10000,
 * 		file: '/path/to/file.js',
 * 		config: {  }
 * }
 */

const keepAlive = true;
let interval;
const services = [];

function timeoutHandler() {
	// Loop over all of the services
	services.forEach((service) => {
		try {
			// If the service specifies an interval than use that, otherwise use the interval from the configuration
			const serviceInterval = service.service.interval
				? service.service.interval
				: service.configInterval;
			// If interval has passed since the last run, run now
			if (!service.running && Date.now() > service.lastRun + serviceInterval) {
				// Service is running
				service.running = true;
				const startTs = Date.now();

				// Run and update the last run time
				service.service
					.run(service.config)
					.then(() => {
						service.lastRun = Date.now();
						service.running = false;
						logger.debug(
							'Scheduler: Ran %s in %s ms',
							service.file,
							Date.now() - startTs
						);
					})
					.catch((err) => {
						// failure... eventually, we may want to react differently
						service.lastRun = Date.now();
						service.running = false;
						logger.warn(
							'Scheduler: %s failed in %s ms',
							service.file,
							Date.now() - startTs
						);
					});
			}
		} catch (err) {
			// the main loop won't die if a service is failing
			logger.error(
				err,
				`Scheduler: Unexpected error running scheduled service: ${service.file}, continuing execution.`
			);
		}
	});

	if (keepAlive) {
		setTimeout(timeoutHandler, interval);
	}
}

module.exports.start = function () {
	// Only start if we're actually configured
	if (null != config.scheduler) {
		const serviceConfigs = config.scheduler.services || [];

		// Initialize the services
		serviceConfigs.forEach((serviceConfig) => {
			const service = {};

			// Get the implementation of the service
			service.file = serviceConfig.file;
			service.service = require(path.posix.resolve(serviceConfig.file));

			// Store the original service config
			service.config = serviceConfig.config;

			// Get the service run interval
			service.configInterval = serviceConfig.interval;
			service.lastRun = 0;

			// Validate the service
			if (null == service.configInterval || service.configInterval < 1000) {
				logger.warn(service, 'Scheduler: Bad service configuration provided');
			} else {
				// Store it in the services array
				services.push(service);
			}
		});

		// Start the timer
		interval = config.scheduler.interval || 10000;
		setTimeout(timeoutHandler, 0);
	}
};
