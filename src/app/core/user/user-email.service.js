'use strict';

const
	deps = require('../../../dependencies'),

	config = deps.config,
	emailService = deps.emailService,
	logger = deps.logger;

// Send email alert to system admins about new account request
module.exports.emailApprovedUser = async (user, req) => {
	try {
		let mailOptions = await emailService.generateMailOptions(user, req, config.coreEmails.approvedUserEmail, {}, {}, {
			to: user.email
		});
		await emailService.sendMail(mailOptions);
		logger.debug(`Sent approved user (${user.username}) alert email`);
	} catch (error) {
		// Log the error but this shouldn't block
		logger.error({err: error, req: req}, 'Failure sending email.');
	}

	return user;
};

// Send email alert to system admins about new account request
module.exports.signupEmail = async (user, req) => {
	try {
		let mailOptions = await emailService.generateMailOptions(user, req, config.coreEmails.userSignupAlert);
		await emailService.sendMail(mailOptions);
		logger.debug(`Sent new user (${user.username}) alert email`);
	} catch (error) {
		// Log the error but this shouldn't block the user from signing up
		logger.error({err: error, req: req}, 'Failure sending email.');
	}

	return user;
};

// Send welcome email to new user
module.exports.welcomeEmail = async (user, req) => {
	try {
		let mailOptions = await emailService.generateMailOptions(user, req, config.coreEmails.welcomeEmail, {}, {}, {
			to: user.email
		});
		await emailService.sendMail(mailOptions);
		logger.debug(`Sent welcome email to: ${mailOptions.to}`);
	} catch (error) {
		// Log the error but this shouldn't block the user from signing up
		logger.error({err: error, req: req}, 'Failure sending email.');
	}

	return user;
};
