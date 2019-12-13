'use strict';

const
	deps = require('../../../../dependencies'),
	dbs = deps.dbs,
	logger = deps.logger,
	userPasswordService = require('./user-password.service'),

	User = dbs.admin.model('User');

/**
 * Forgot for reset password (forgot POST)
 */
exports.forgot = async (req, res) => {
	// Make sure there is a username
	if(null == req.body.username) {
		return res.status(400).json({ message: 'Username is missing.' });
	}

	logger.info('Password reset request for username: %s', req.body.username);

	try {
		let token = await userPasswordService.generateToken();

		let user = await userPasswordService.setResetTokenForUser(req.body.username, token);

		await userPasswordService.sendResetPasswordEmail(user, token, req);
		res.json(`An email has been sent to ${user.email} with further instructions.`);
	} catch (error) {
		res.status(400).json({ message: 'Failure generating reset password token.' });
	}
};


/**
 * Reset password GET from email token
 */
exports.validateResetToken = async (req, res) => {
	let user = await User.findOne({
		resetPasswordToken: req.params.token,
		resetPasswordExpires: { $gt: Date.now() }
	}).exec();

	if (!user) {
		res.status('400').json({ message: 'invalid-token' });
	} else {
		res.json({ message: 'valid-token' });
	}
};


/**
 * Reset password POST from email token
 */
exports.reset = async (req, res) => {
	// Init Variables
	let password = req.body.password;

	// Make sure there is a username
	if(null == password) {
		return res.status(400).json({ message: 'Password is missing.' });
	}

	try {
		let user = await userPasswordService.resetPasswordForToken(req.params.token, req.body.password);

		await userPasswordService.sendPasswordResetConfirmEmail(user, req);

		res.json(`An email has been sent to ${user.email} letting them know their password was reset.`);
	} catch (error) {
		res.status(400).json({ message: 'Failure resetting password.' });
	}
};
