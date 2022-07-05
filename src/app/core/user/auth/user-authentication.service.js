'use strict';

const _ = require('lodash'),
	passport = require('passport'),
	{ auditService, config, dbs } = require('../../../../dependencies'),
	User = dbs.admin.model('User'),
	accessChecker = require('../../access-checker/access-checker.service'),
	userEmailService = require('../../user/user-email.service');

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

			userEmailService.welcomeWithAccessEmail(user, req);

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
				req,
				{}
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
					req,
					{ username: username }
				);

				return reject(info);
			}
			// Else the authentication was successful
			// Set the user ip if available.
			user.ip = req.headers?.['x-real-ip'] ?? null;
			module.exports.login(user, req).then(resolve).catch(reject);
		})(req, res, next);
	});
};

function copyACMetadata(dest, src) {
	// Copy each field from the access checker user to the local user
	['name', 'organization', 'email', 'username'].forEach((e) => {
		// Only overwrite if there's a value
		if (src?.[e]?.trim() ?? '' !== '') {
			dest[e] = src[e];
		}
	});

	// Always overwrite these fields
	dest.externalRoles = src?.roles ?? [];
	dest.externalGroups = src?.groups ?? [];
	return dest;
}

/**
 * Create the user locally given the information from access checker
 */
async function createUser(dn, acUser) {
	// Create the new user
	const newUser = new User({
		name: 'unknown',
		organization: 'unknown',
		organizationLevels: {},
		email: 'unknown@mail.com',
		username: dn.toLowerCase()
	});

	// Copy over the access checker metadata
	copyACMetadata(newUser, acUser);

	// Add the provider data
	newUser.providerData = { dn: dn, dnLower: dn.toLowerCase() };
	newUser.provider = 'pki';

	// Initialize the new user
	const initializedUser = await module.exports.initializeNewUser(newUser);

	// Check for existing user with same username
	const existingUser = await User.findOne({
		username: initializedUser.username
	}).exec();

	// If existing user exists, update providerData with dn
	if (existingUser) {
		existingUser.providerData.dn = dn;
		existingUser.providerData.dnLower = dn.toLowerCase();
		return existingUser.save();
	}

	// else save
	return initializedUser.save();
}

const autoCreateUser = async (dn, req, acUser) => {
	// Create the user
	const newUser = await createUser(dn, acUser);

	userEmailService.signupEmail(newUser, req);
	userEmailService.welcomeNoAccessEmail(newUser, req);

	// Audit user signup
	await auditService.audit(
		'user signup',
		'user',
		'user signup',
		req,
		User.auditCopy(newUser)
	);

	return newUser;
};

module.exports.verifyUser = async (dn, req, isProxy = false) => {
	const dnLower = dn.toLowerCase();

	const localUser = await User.findOne({
		'providerData.dnLower': dnLower
	}).exec();

	// Bypass AC check
	if (localUser?.bypassAccessCheck) {
		return localUser;
	}

	const acUser = await accessChecker.get(dnLower);

	// Default to creating accounts automatically
	const autoCreateAccounts = config?.auth?.autoCreateAccounts ?? true;

	// If the user is not known locally, is not known by access checker, and we are creating accounts, create the account as an empty account
	if (null == localUser && null == acUser && (isProxy || !autoCreateAccounts)) {
		throw {
			status: 401,
			type: 'invalid-credentials',
			message: 'Certificate unknown, expired, or unauthorized'
		};
	}

	// Else if the user is not known locally, and we are creating accounts, create the account as an empty account
	if (null == localUser && autoCreateAccounts) {
		return autoCreateUser(dn, req, acUser);
	}

	// update local user with is known locally, but not in access checker, update their user info to reflect
	copyACMetadata(localUser, acUser);

	// Audit user update
	await auditService.audit(
		'user updated from access checker',
		'user',
		'update',
		req,
		User.auditCopy(localUser)
	);

	return localUser.save();
};
