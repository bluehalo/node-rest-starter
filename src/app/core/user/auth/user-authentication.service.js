'use strict';

const
	_ = require('lodash'),
	passport = require('passport'),
	q = require('q'),

	deps = require('../../../../dependencies'),
	auditService = deps.auditService,
	config = deps.config,
	dbs = deps.dbs,
	util = deps.utilService,
	emailService = deps.emailService,
	logger = deps.logger,

	User = dbs.admin.model('User');


/**
 * ==========================================================
 * Private methods
 * ==========================================================
 */



/**
 * ==========================================================
 * Public Methods
 * ==========================================================
 */

/**
 * Initialize a new user
 * This method applies any common business logic that happens
 * when a new user is created in the system.
 */
module.exports.initializeNewUser = function(user) {
	// Add the default roles
	if (null != config.auth.defaultRoles) {
		user.roles = user.roles || {};
		_.defaults(user.roles, config.auth.defaultRoles);
	}

	// Resolve the user (this might seem like overkill, but planning for the future)
	return q(user);
};

// Send email alert to system admins about new account request
module.exports.signupEmail = function(user, req) {
	let defer = q.defer();

	emailService.buildEmailContent('admin/templates/user-signup-alert-email', {
		name: user.name,
		username: user.username,
		appName: config.app.title,
		url: `${config.app.clientUrl}/admin/users`
	}).then((html) => {
		let to = config.newUser.adminEmail;

		let mailOptions = {
			to: to,
			from: config.mailer.from,
			replyTo: config.mailer.from,
			subject: emailService.getSubject(`New Account Request - ${config.app.serverUrl}`),
			html: html
		};

		emailService.sendMail(mailOptions)
			.then((result) => {
				logger.debug(`Sent new user(${user.username}) email to: ${to}`);
				defer.resolve(user);
			}, (error) => {
				// Log the error but this shouldn't block
				// the user from signing up
				logger.error({err: error, req: req}, 'Failure sending email.');
				defer.resolve(user);
			});
	}).fail((error) => {
		logger.error({err: error, req: req}, 'Failure rendering template.');
		defer.reject(error);
	});

	return defer.promise;
};

// Send welcome email to new user
module.exports.welcomeEmail = (user, req) => {
	let defer = q.defer();

	const appTitle = config.app.title;

	emailService.buildEmailContent('admin/templates/user-welcome-email', {
		name: user.name,
		username: user.username,
		appName: appTitle,
		url: `${config.app.clientUrl}/help/getting-started`
	}).then((html) => {
		const to = user.email;

		const mailOptions = {
			to: to,
			from: config.mailer.from,
			replyTo: config.mailer.from,
			subject: emailService.getSubject(`Welcome to ${appTitle}!`),
			html: html
		};

		emailService.sendMail(mailOptions).then(() => {
			logger.debug(`Sent welcome email to: ${to}`);
			defer.resolve(user);
		}, (error) => {
			// Log the error but this shouldn't block the user from signing up
			logger.error({err: error, req: req}, 'Failure sending email.');
			defer.resolve(user);
		});
	}).fail((error) => {
		logger.error({err: error, req: req}, 'Failure rendering template.');
		defer.reject(error);
	});

	return defer.promise;
};


/**
 * Login the user
 * Does the work to log the user into the system
 * Updates the last logged in time
 * Audits the action
 */
module.exports.login = function(user, req) {
	let defer = q.defer();

	// Remove sensitive data before login
	delete user.password;
	delete user.salt;

	// Calls the login function (which goes to passport)
	req.login(user, function(err) {
		if (err) {
			defer.reject({ status: 500, type: 'login-error', message: err });
		} else {

			// update the user's last login time
			User.findOneAndUpdate(
				{ _id: user._id },
				{ lastLogin: Date.now() },
				{ new: true, upsert: false },
				function(err, user) {
					if(null != err) {
						defer.reject({ status: 500, type: 'login-error', message: err });
					}
					else {
						defer.resolve(User.fullCopy(user));
					}
				}
			);

			// Audit the login
			auditService.audit('User successfully logged in', 'user-authentication', 'authentication succeeded', {}, User.auditCopy(user, util.getHeaderField(req.headers, 'x-real-ip')), req.headers);
		}
	});

	return defer.promise;
};

/**
 * Authenticate and then login depending on the outcome
 */
module.exports.authenticateAndLogin = function(req, res, next) {
	let defer = q.defer();

	// Attempt to authenticate the user using passport
	passport.authenticate(config.auth.strategy, (err, user, info, status) => {

		// If there was an error
		if(null != err) {
			// Reject the promise with a 500 error
			defer.reject({ status: 500, type: 'authentication-error', message: err });
		}
		// If the authentication failed
		else if (!user) {
			// In the case of a auth failure, info should have the reason
			// Here is a hack for the local strategy...
			if(null == info.status && null != status) {
				info.status = status;
				if(info.message === 'Missing credentials') {
					info.type = 'missing-credentials';
				}
			}

			defer.reject(info);

			// Try to grab the username from the request
			let username = (req.body && req.body.username)? req.body.username : 'none provided';

			// Audit the failed attempt
			auditService.audit(info.message, 'user-authentication', 'authentication failed',
				{ }, { username: username }, req.headers);

		}
		// Else the authentication was successful
		else {
			// Set the user ip if available.
			user.ip = ( _.isUndefined(req.headers['x-real-ip']) ) ? null : req.headers['x-real-ip'];
			module.exports.login(user, req).then(defer.resolve, defer.reject);
		}

	})(req, res, next);

	return defer.promise;
};
