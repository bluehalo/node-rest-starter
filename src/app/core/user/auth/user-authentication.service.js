'use strict';

const _ = require('lodash'),
	passport = require('passport'),
	deps = require('../../../../dependencies'),
	auditService = deps.auditService,
	config = deps.config,
	dbs = deps.dbs,
	util = deps.utilService,
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
module.exports.initializeNewUser = function (user) {
	// Add the default roles
	if (null != config.auth.defaultRoles) {
		user.roles = user.roles || {};
		_.defaults(user.roles, config.auth.defaultRoles);
	}

	// Resolve the user (this might seem like overkill, but planning for the future)
	return Promise.resolve(user);
};

/**
 * Login the user
 * Does the work to log the user into the system
 * Updates the last logged in time
 * Audits the action
 */
module.exports.login = (user, req) => {
	return new Promise((resolve, reject) => {
		// Remove sensitive data before login
		delete user.password;
		delete user.salt;

		// Calls the login function (which goes to passport)
		req.login(user, (err) => {
			if (err) {
				return reject({ status: 500, type: 'login-error', message: err });
			}
			// update the user's last login time
			User.findOneAndUpdate(
				{ _id: user._id },
				{ lastLogin: Date.now() },
				{ new: true, upsert: false },
				(_err, _user) => {
					if (null != _err) {
						return reject({ status: 500, type: 'login-error', message: _err });
					}
					return resolve(User.fullCopy(_user));
				}
			).exec();

			// Audit the login
			auditService.audit(
				'User successfully logged in',
				'user-authentication',
				'authentication succeeded',
				{},
				User.auditCopy(user, util.getHeaderField(req.headers, 'x-real-ip')),
				req.headers
			);
		});
	});
};

/**
 * Authenticate and then login depending on the outcome
 */
module.exports.authenticateAndLogin = function (req, res, next) {
	return new Promise((resolve, reject) => {
		// Attempt to authenticate the user using passport
		passport.authenticate(config.auth.strategy, (err, user, info, status) => {
			// If there was an error
			if (err) {
				// Reject the promise with a 500 error
				return reject({
					status: 500,
					type: 'authentication-error',
					message: err
				});
			}
			// If the authentication failed
			if (!user) {
				// In the case of a auth failure, info should have the reason
				// Here is a hack for the local strategy...
				if (null == info.status && null != status) {
					info.status = status;
					if (info.message === 'Missing credentials') {
						info.type = 'missing-credentials';
					}
				}

				// Try to grab the username from the request
				const username =
					req.body && req.body.username ? req.body.username : 'none provided';

				// Audit the failed attempt
				auditService.audit(
					info.message,
					'user-authentication',
					'authentication failed',
					{},
					{ username: username },
					req.headers
				);

				return reject(info);
			}
			// Else the authentication was successful
			// Set the user ip if available.
			user.ip = _.isUndefined(req.headers['x-real-ip'])
				? null
				: req.headers['x-real-ip'];
			module.exports.login(user, req).then(resolve).catch(reject);
		})(req, res, next);
	});
};
