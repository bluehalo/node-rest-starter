'use strict';

const
	q = require('q'),
	deps = require('../../../../dependencies'),
	logger = deps.logger;

const services = [
	{
		path: require('./inactive-user-email.service'),
		name: 'inactive-user-notification'
	}
];

module.exports.run = function(config) {

	let notifyInactiveUsers = services.map((service) => service.path.run(config));
	return q.allSettled(notifyInactiveUsers)
		.then((results) => {
			results.forEach((result, idx) => {
				if (result.state === 'rejected') {
					logger.error(`Error running service=${services[idx].name}. Error=${JSON.stringify(result.reason)}`);
				} else {
					logger.debug(`Ran service=${services[idx].name} to email inactive users`);
				}
			});

		});
};

