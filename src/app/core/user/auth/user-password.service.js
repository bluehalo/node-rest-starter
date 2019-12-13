'use strict';

const
	crypto = require('crypto'),
	moment = require('moment'),

	deps = require('../../../../dependencies'),
	dbs = deps.dbs,
	config = deps.config,
	logger = deps.logger,
	emailService = deps.emailService,
	errorService = deps.errorService,

	User = dbs.admin.model('User');

module.exports.generateToken = () => {
	return new Promise((resolve, reject) => {
		crypto.randomBytes(20, (error, buffer) => {
			if (error) {
				reject(error);
			} else {
				let token = buffer.toString('hex');
				logger.debug('Generated reset token.');
				resolve(token);
			}
		});
	});
};

module.exports.setResetTokenForUser = async (username, token) => {
	// Try to find the user
	let user;
	try {
		user = await User.findOne({	username: username }, '-salt -password').exec();
	} catch (error) {
		return Promise.reject({ message: 'No account with that username has been found.' });
	}

	if (!user) {
		return Promise.reject({ message: 'No account with that username has been found.' });
	}

	logger.debug('Found the user.');

	// Generate the token and the expire date/time
	user.resetPasswordToken = token;
	user.resetPasswordExpires = moment().add(1, 'hour');

	// Save the user with the token
	try {
		await user.save();
	} catch (error) {
		logger.debug('Saved the user with reset token.');
	}

	return user;
};

module.exports.resetPasswordForToken = async (token, password) => {
	let user;
	try {
		user = await User.findOne({
			resetPasswordToken: token,
			resetPasswordExpires: { $gt: Date.now() }
		}).exec();
	} catch (error) {
		return Promise.reject({ message: 'Password reset token is invalid or has expired.' });
	}
	if (!user) {
		return Promise.reject({ message: 'Password reset token is invalid or has expired.' });
	}

	user.password = password;
	user.resetPasswordToken = undefined;
	user.resetPasswordExpires = undefined;

	try {
		await user.save();
	} catch (error) {
		return Promise.reject({ message: errorService.getErrorMessage(error) });
	}

	return user;
};

// Send email to user with instructions on resetting password
module.exports.sendResetPasswordEmail = async (user, token, req) => {
	try {
		let mailOptions = await emailService.generateMailOptions(user, req, config.coreEmails.resetPassword, {
			token: token
		}, {}, {
			to: user.email
		});
		await emailService.sendMail(mailOptions);
		logger.debug(`Sent reset password email to user (${user.username})`);
	} catch (error) {
		// Log the error but this shouldn't block
		logger.error({err: error, req: req}, 'Failure sending email.');
	}

	return user;
};

// Send email to user confirming password was reset
module.exports.sendPasswordResetConfirmEmail = async (user, req) => {
	try {
		let mailOptions = await emailService.generateMailOptions(user, req, config.coreEmails.resetPasswordConfirm, {}, {}, {
			to: user.email
		});
		await emailService.sendMail(mailOptions);
		logger.debug(`Sent reset password email to user (${user.username})`);
	} catch (error) {
		// Log the error but this shouldn't block
		logger.error({err: error, req: req}, 'Failure sending email.');
	}

	return user;
};
