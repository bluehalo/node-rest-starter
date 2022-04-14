'use strict';

const { DateTime } = require('luxon'),
	deps = require('../../../dependencies'),
	config = deps.config,
	emailService = deps.emailService,
	logger = deps.logger,
	userService = require('./user.service'),
	userAuthorizationService = require('./auth/user-authorization.service');

// Send email alert to system admins about new account request
module.exports.emailApprovedUser = async (user, req) => {
	try {
		const mailOptions = await emailService.generateMailOptions(
			user,
			req,
			config.coreEmails.approvedUserEmail,
			{},
			{},
			{
				to: user.email
			}
		);
		await emailService.sendMail(mailOptions);
	} catch (error) {
		// Log the error but this shouldn't block
		logger.error({ err: error, req: req }, 'Failure sending email.');
	}
};

// Send email alert to system admins about new account request
module.exports.signupEmail = async (user, req) => {
	if (!(config.coreEmails?.userSignupAlert?.enabled ?? false)) {
		return;
	}
	try {
		const mailOptions = await emailService.generateMailOptions(
			user,
			req,
			config.coreEmails.userSignupAlert
		);
		await emailService.sendMail(mailOptions);
	} catch (error) {
		// Log the error but this shouldn't block the user from signing up
		logger.error({ err: error, req: req }, 'Failure sending email.');
	}
};

// Send welcome email to new user
module.exports.welcomeNoAccessEmail = async (user, req) => {
	if (!(config.coreEmails?.welcomeNoAccess?.enabled ?? false)) {
		return;
	}
	const skipForRole = config.coreEmails.welcomeNoAccess.skipIfUserHasRole;
	if (!skipForRole || !userAuthorizationService.hasRole(user, skipForRole)) {
		try {
			const mailOptions = await emailService.generateMailOptions(
				user,
				req,
				config.coreEmails.welcomeNoAccess,
				{},
				{},
				{
					to: user.email
				}
			);
			await emailService.sendMail(mailOptions);
		} catch (error) {
			// Log the error but this shouldn't block the user from signing up
			logger.error({ err: error, req: req }, 'Failure sending email.');
		}
	}
};

// Send welcome email to new user
module.exports.welcomeWithAccessEmail = async (user, req) => {
	if (!(config.coreEmails?.welcomeWithAccess?.enabled ?? false)) {
		return;
	}

	const recentCutoff = DateTime.now().minus(
		config.coreEmails.welcomeWithAccess.recentDuration ?? {
			days: 90
		}
	);
	const accessRole = config.coreEmails.welcomeWithAccess.accessRole;

	if (accessRole && userAuthorizationService.hasRole(user, accessRole)) {
		if (recentCutoff.toMillis() > user.lastLoginWithAccess) {
			try {
				const mailOptions = await emailService.generateMailOptions(
					user,
					req,
					config.coreEmails.welcomeWithAccess,
					{},
					{},
					{
						to: user.email
					}
				);
				await emailService.sendMail(mailOptions);
			} catch (error) {
				// Log the error but this shouldn't block the user from signing up
				logger.error({ err: error, req: req }, 'Failure sending email.');
			}
		}
		userService.updateLastLoginWithAccess(user);
	}
};
