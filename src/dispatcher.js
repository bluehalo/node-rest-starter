'use strict';

const
	path = require('path'),

	deps = require('./dependencies'),
	config = deps.config;


module.exports.start = () => {
	// Only start if we're actually configured
	if (config.dispatcher && config.dispatcher.enabled) {
		let serviceConfigs = config.dispatcher.services || [];

		// Initialize the services
		serviceConfigs.forEach(function(serviceConfig) {
			let service = require(path.posix.resolve(serviceConfig.file));
			service.start(serviceConfig.config);
		});
	}
};
