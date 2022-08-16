'use strict';

const { DateTime } = require('luxon');
const _ = require('lodash'),
	deps = require('../../../../dependencies'),
	dbs = deps.dbs,
	config = deps.config,
	emailService = deps.emailService,
	auditService = deps.auditService,
	logger = deps.logger;

/**
 * @type {import('../types').UserModel}
 */
const User = dbs.admin.model('User');

/**
 * Import types for reference below
 * @typedef {import('../types').UserDocument} UserDocument
 */

const sendEmail = async (user, emailConfig) => {
	// This current DateTime may be a millisecond or two later than user.lastLogin due to Luxon's precision, so we round down to the number of days.
	const numOfDays = Math.floor(
		DateTime.now().diff(DateTime.fromMillis(user.lastLogin)).as('days')
	);
	try {
		const mailOptions = await emailService.generateMailOptions(
			user,
			null,
			emailConfig,
			{
				daysAgo: numOfDays
			},
			{},
			{
				to: user.email
			}
		);
		await emailService.sendMail(mailOptions);
		logger.debug('Sent team request email');
	} catch (error) {
		// Log the error but this shouldn't block
		logger.error({ err: error }, 'Failure sending email.');
	}
};

/**
 * @param {import('mongoose').FilterQuery<UserDocument>} dQuery
 */
const deactivationAlert = async (dQuery) => {
	const deactivatedUsers = await User.find(dQuery).exec();
	if (_.isArray(deactivatedUsers)) {
		const promises = deactivatedUsers.map(async (user) => {
			const originalUser = User.auditCopy(user);

			user.roles.admin = false;
			user.roles.user = false;
			user.markModified('roles');
			await user.save();

			await sendEmail(user, config.coreEmails.userDeactivate);

			await auditService.audit(
				'deactivation due to inactivity',
				'user',
				'deactivation',
				null,
				{ before: originalUser, after: User.auditCopy(user) },
				null
			);
		});

		return Promise.all(promises);
	}
};

/**
 * @param {import('mongoose').FilterQuery<UserDocument>} dQuery
 */
const inactivityAlert = async (dQuery) => {
	const inactiveUsers = await User.find(dQuery).exec();
	return Promise.all(
		inactiveUsers.map((user) =>
			sendEmail(user, config.coreEmails.userInactivity)
		)
	);
};

/**
 * alert users whose accounts have been inactive for 30-89 days. Remove accounts that have been inactive for 90+ days
 *
 * @param {import('agenda').Job} job
 * @returns {Promise<void>}
 */
module.exports.run = async (job) => {
	const alertQueries = job.attrs.data.alertIntervals.map((interval) => ({
		lastLogin: {
			$lte: DateTime.now().minus({ milliseconds: interval }).toJSDate(),
			$gt: DateTime.now().minus({ milliseconds: interval, days: 1 }).toJSDate()
		},
		'roles.user': true
	}));

	const deactivateQuery = {
		lastLogin: {
			$lte: DateTime.now()
				.minus({ milliseconds: job.attrs.data.deactivateAfter })
				.toJSDate()
		},
		'roles.user': true
	};

	await Promise.all([
		deactivationAlert(deactivateQuery),
		...alertQueries.map((query) => inactivityAlert(query))
	]).then();
};

module.exports.sendEmail = sendEmail;
