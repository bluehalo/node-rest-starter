'use strict';

const path = require('path'),
	deps = require('./dependencies'),
	config = deps.config;

module.exports.start = () => {
	// Only start if we're actually configured
	if (config.dispatcher && config.dispatcher.enabled) {
		const serviceConfigs = config.dispatcher.services || [];

		// Initialize the services
		serviceConfigs.forEach((serviceConfig) => {
			const service = require(path.posix.resolve(serviceConfig.file));
			service.start(serviceConfig.config);
		});
	}
};
