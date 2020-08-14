'use strict';

const
	deps = require('../../../dependencies'),

	config = deps.config,
	emailService = deps.emailService,
	logger = deps.logger;

// Send email alert to system admins about new account request
module.exports.emailApprovedUser = async (user, req) => {
	try {
		const mailOptions = await emailService.generateMailOptions(user, req, config.coreEmails.approvedUserEmail, {}, {}, {
			to: user.email
		});
		await emailService.sendMail(mailOptions);
	} catch (error) {
		// Log the error but this shouldn't block
		logger.error({err: error, req: req}, 'Failure sending email.');
	}
};

// Send email alert to system admins about new account request
module.exports.signupEmail = async (user, req) => {
	try {
		const mailOptions = await emailService.generateMailOptions(user, req, config.coreEmails.userSignupAlert);
		await emailService.sendMail(mailOptions);
	} catch (error) {
		// Log the error but this shouldn't block the user from signing up
		logger.error({err: error, req: req}, 'Failure sending email.');
	}
};

// Send welcome email to new user
module.exports.welcomeEmail = async (user, req) => {
	try {
		const mailOptions = await emailService.generateMailOptions(user, req, config.coreEmails.welcomeEmail, {}, {}, {
			to: user.email
		});
		await emailService.sendMail(mailOptions);
	} catch (error) {
		// Log the error but this shouldn't block the user from signing up
		logger.error({err: error, req: req}, 'Failure sending email.');
	}
};
