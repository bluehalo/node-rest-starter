'use strict';

const
	_ = require('lodash'),
	q = require('q'),

	deps = require('../../../../dependencies'),
	dbs = deps.dbs,
	configc = deps.config,
	emailService = deps.emailService,
	auditService = deps.auditService,
	logger = deps.logger,

	User = dbs.admin.model('User');

const day = 86400000;

function buildEmailContent(resource, emailTemplateName) {
	let numOfDays = Math.floor((Date.now() - resource.lastLogin)/day);
	let emailData = {
		appName: configc.app.instanceName,
		url: configc.app.clientUrl, // message of the day board
		name: resource.name,
		date: numOfDays,
		contactEmail: configc.contactEmail
	};

	return emailService.buildEmailContent(`util/templates/${emailTemplateName}-email`, emailData);
}

function deactivationAlert(dQuery, config) {
	return User.find(dQuery).exec().then((deactivatedUsers) => {
			if (_.isArray(deactivatedUsers)) {
				deactivatedUsers.forEach((user) => {
					let originalUser = User.auditCopy(user);

					return buildEmailContent(user, 'deactivate', config).then((emailContent) => {
						let mailOptions = {
							from: configc.mailer.from,
							replyTo: configc.mailer.from,
							to: user.email,
							subject: emailService.getSubject('Account Deactivation'),
							html: emailContent
						};

						return User.update({'username': user.username}, {
							$set: {
								'roles.user': false,
								'roles.admin': false
							}
						}).then(() => {
							user.roles.admin = false;
							user.roles.user = false;
						}).then(() => {
							let emailPromise = emailService.sendMail(mailOptions);
							let auditPromise = auditService.audit('deactivation due to inactivity','user','deactivation', null, {before: originalUser, after: User.auditCopy(user)}, null);
							return q.all([emailPromise, auditPromise]);
						});
					});
				});
			}

		});
}

function inactivityAlert(query, config) {
	return q.all(query.map((iQuery) => User.find(iQuery).exec())).then((usersLastLogin) => {
		if (_.isArray(usersLastLogin)) {
			usersLastLogin.forEach((login) => {
				login.forEach((entry) => {
					return buildEmailContent(entry, 'inactivity', config).then((emailContent) => {
						let mailOptions = {
							from: configc.mailer.from,
							replyTo: configc.mailer.from,
							to: entry.email,
							subject: emailService.getSubject('Inactivity Notice'),
							html: emailContent
						};
						return emailService.sendMail(mailOptions)
							.then(() => {
								logger.debug('Sent email');
							});
					});
				});
			});
		}
	});
}

/**
 * alert users whose accounts have been inactive for 30-89 days. Remove accounts that have been inactive for 90+ days
 */
module.exports.run = function(config) {

	let alertQueries = config.alertInterval.map((interval) => ({
		lastLogin: {
			$lte:  new Date(Date.now() - interval).toISOString(),
			$gt: new Date(Date.now() - interval - day).toISOString()
		},
		'roles.user': true
	}));

	let deactivateQuery = {
		lastLogin: {
			$lte: new Date(Date.now() - config.deactivateAfter).toISOString()
		},
		'roles.user': true
	};

	let deactivatePromise = deactivationAlert(deactivateQuery, config);
	let inactivityPromise = inactivityAlert(alertQueries, config);

	return q.all([deactivatePromise, inactivityPromise])
		.then((data) => {
			logger.debug('Both promises have resolved', data);
		})
		.fail((err) => {
			logger.error(`Failed scheduled run to deactivate inactive users. Error=${JSON.stringify(err)}`);
			return q.reject(err);
		});
};
