'use strict';

const
	_ = require('lodash'),
	moment = require('moment'),

	deps = require('../../../../dependencies'),
	dbs = deps.dbs,
	config = deps.config,
	emailService = deps.emailService,
	auditService = deps.auditService,
	logger = deps.logger,

	User = dbs.admin.model('User');

async function sendEmail(user, emailConfig) {
	const numOfDays = moment().diff(user.lastLogin, 'days');
	try {
		const mailOptions = await emailService.generateMailOptions(user, null, emailConfig, {
			daysAgo: numOfDays
		}, {}, {
			to: user.email
		});
		await emailService.sendMail(mailOptions);
		logger.debug('Sent team request email');
	} catch (error) {
		// Log the error but this shouldn't block
		logger.error({err: error}, 'Failure sending email.');
	}
}

async function deactivationAlert(dQuery) {
	const deactivatedUsers = await User.find(dQuery).exec();
	if (_.isArray(deactivatedUsers)) {

		const promises = deactivatedUsers.map((user) => {
			const originalUser = User.auditCopy(user);

			user.roles.admin = false;
			user.roles.user = false;

			return user.save().then(() => {
				const emailPromise = sendEmail(user, config.coreEmails.userDeactivate);
				const auditPromise = auditService.audit('deactivation due to inactivity','user','deactivation', null, {before: originalUser, after: User.auditCopy(user)}, null);
				return Promise.all([emailPromise, auditPromise]);
			});
		});

		return Promise.all(promises);
	}
}


async function inactivityAlert(dQuery) {
	const inactiveUsers = await User.find(dQuery).exec();
	if (_.isArray(inactiveUsers)) {
		const promises = inactiveUsers.map((user) => {
			return sendEmail(user, config.coreEmails.userInactivity);
		});
		return Promise.all(promises);
	}
}

/**
 * alert users whose accounts have been inactive for 30-89 days. Remove accounts that have been inactive for 90+ days
 */
module.exports.run = function(serviceConfig) {

	const alertQueries = serviceConfig.alertInterval.map((interval) => ({
		lastLogin: {
			$lte:  new Date(Date.now() - interval).toISOString(),
			$gt: new Date(Date.now() - interval - 86400000).toISOString()
		},
		'roles.user': true
	}));

	const deactivateQuery = {
		lastLogin: {
			$lte: new Date(Date.now() - serviceConfig.deactivateAfter).toISOString()
		},
		'roles.user': true
	};

	const deactivatePromise = deactivationAlert(deactivateQuery);
	const inactivityPromise = inactivityAlert(alertQueries);

	return Promise.all([deactivatePromise, inactivityPromise]).then((data) => {
		logger.debug('Both promises have resolved', data);
	}).catch((err) => {
		logger.error(`Failed scheduled run to deactivate inactive users. Error=${JSON.stringify(err)}`);
		return Promise.reject(err);
	});
};

module.exports.sendEmail = sendEmail;
