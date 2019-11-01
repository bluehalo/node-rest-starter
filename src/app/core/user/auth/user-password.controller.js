'use strict';

const
	async = require('async'),
	crypto = require('crypto'),

	deps = require('../../../../dependencies'),
	dbs = deps.dbs,
	config = deps.config,
	errorService = deps.errorService,
	logger = deps.logger,
	emailService = deps.emailService,

	User = dbs.admin.model('User');

/**
 * Forgot for reset password (forgot POST)
 */
exports.forgot = (req, res, next) => {

	// Make sure there is a username
	if(null == req.body.username) {
		return res.status(400).json({ message: 'Username is missing.' });
	}

	logger.info('Password reset request for username: %s', req.body.username);

	async.waterfall([
		// Generate random token
		(done) => {
			crypto.randomBytes(20, (error, buffer) => {
				let token = buffer.toString('hex');
				logger.debug('Generated reset token.');
				done(error, token);
			});
		},

		// Lookup user by username
		(token, done) => {

			// Try to find the user
			User.findOne({
				username: req.body.username
			}, '-salt -password', (error, user) => {

				// If we failed to find the user by username
				if (null != error || null == user) {
					return res.status(400).json({
						message: 'No account with that username has been found.'
					});
				}

				// Generate the token and the expire date/time
				user.resetPasswordToken = token;
				user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

				logger.debug('Found the user.');

				// Save the user with the token
				user.save((error) => {
					logger.debug('Saved the user with reset token.');
					done(error, token, user);
				});

			});
		},

		// Generate the email message (from template)
		(token, user, done) => {
			emailService.buildEmailContent('src/app/core/user/templates/reset-password-email.server.view.html', {
				name: user.name,
				appName: config.app.title,
				url: `${config.app.clientUrl}/password/reset/${token}`
			}).then((emailHTML) => {
				done(undefined, emailHTML, user);
			}).fail((error) => {
				done(error, undefined, user);
			});
		},

		// Send the email
		(emailHTML, user, done) => {
			let mailOptions = {
				to: user.email,
				from: config.mailer.from,
				replyTo: config.mailer.from,
				subject: emailService.getSubject('Password Reset'),
				html: emailHTML
			};

			emailService.sendMail(mailOptions)
				.then((result) => {
					logger.debug(`Sent email to: ${user.email}`);
					res.json(`An email has been sent to ${user.email} with further instructions.`);
					done(null);

				}, (error) => {
					logger.error({err: error, req: req}, 'Failure sending email.');
					return res.status(400).json({ message: 'Failure sending email.' });
				});
		}
	], (error) => {
		if (error) return next(error);
	});
};


/**
 * Reset password GET from email token
 */
exports.validateResetToken = (req, res) => {
	User.findOne({
		resetPasswordToken: req.params.token,
		resetPasswordExpires: {
			$gt: Date.now()
		}
	}, (error, user) => {
		if (!user) {
			return res.status('400').json({ message: 'invalid-token' });
		}

		return res.json({ message: 'valid-token' });
	});
};


/**
 * Reset password POST from email token
 */
exports.reset = (req, res, next) => {

	// Init Variables
	let password = req.body.password;

	// Make sure there is a username
	if(null == password) {
		return res.status(400).json({ message: 'Password is missing.' });
	}


	async.waterfall([

		(done) => {
			User.findOne({
				resetPasswordToken: req.params.token,
				resetPasswordExpires: {
					$gt: Date.now()
				}
			}, (error, user) => {

				if(null != error || null == user) {
					return res.status(400).json({
						message: 'Password reset token is invalid or has expired.'
					});
				}
				user.password = password;
				user.resetPasswordToken = undefined;
				user.resetPasswordExpires = undefined;

				user.save((error) => {
					if (error) {
						return res.status(400).json({
							message: errorService.getErrorMessage(error)
						});
					} else {
						req.login(user, (error) => {
							if (error) {
								return res.status(400).json({
									message: errorService.getErrorMessage(error)
								});
							} else {
								// Return authenticated user
								res.json(User.fullCopy(user));
								done(error, user);
							}
						});
					}
				});
			});
		},

		(user, done) => {
			emailService.buildEmailContent('src/app/core/user/templates/reset-password-confirm-email.server.view.html', {
				name: user.name,
				appName: config.app.title
			}).then((emailHTML) => {
				done(undefined, emailHTML, user);
			}).fail((error) => {
				done(error, undefined, user);
			});
		},

		// If valid email, send reset email using service
		(emailHTML, user, done) => {
			let mailOptions = {
				to: user.email,
				from: config.mailer.from,
				replyTo: config.mailer.from,
				subject: emailService.getSubject('Your password has been changed'),
				html: emailHTML
			};

			emailService.sendMail(mailOptions)
				.then((result) => {
					logger.debug(`Sent email to: ${user.email}`);
					res.json(`An email has been sent to ${user.email} letting them know their password was reset.`);
					done(null);
				}, (error) => {
					logger.error({err: error, req: req}, 'Failure sending email.');
					return res.status(400).json({ message: 'Failure sending email.' });
				});
		}
	], (error) => {
		if (error) return next(error);
	});
};
