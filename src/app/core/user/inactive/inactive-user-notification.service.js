'use strict';

const deps = require('../../../../dependencies'),
	logger = deps.logger;

const services = [
	{
		path: require('./inactive-user-email.service'),
		name: 'inactive-user-notification'
	}
];

module.exports.run = function (config) {
	const notifyInactiveUsers = services.map((service) =>
		service.path
			.run(config)
			.then(() => {
				logger.debug(`Ran service=${service.name} to email inactive users`);
			})
			.catch((err) => {
				logger.error(
					`Error running service=${service.name}. Error=${JSON.stringify(err)}`
				);
				// Ignore any errors notifying inactive users by returning a resolved promise
				return Promise.resolve();
			})
	);

	return Promise.all(notifyInactiveUsers);
};
