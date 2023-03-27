'use strict';

const _ = require('lodash');

const euas = require('./eua/eua.controller');

/**
 * Extend user's controller
 */
module.exports = _.extend(
	require('./auth/user-authentication.controller'),
	require('./auth/user-authorization.controller'),
	require('./auth/user-password.controller'),
	require('./profile/user-profile.controller'),
	require('./admin/user-admin.controller'),
	require('./user-export.controller')
);

/*=====================================
 * Auth Middleware
 *====================================*/

/**
 * Apply the auth requirements as authorization middleware
 * @param requirement The requirement function to invoke
 */
module.exports.has = (requirement) => {
	// Return a function that adapts the requirements to middleware
	return (req, res, next) => {
		Promise.resolve(requirement(req))
			.then(() => {
				next();
			})
			.catch(next);
	};
};

/**
 * Apply the array of auth functions in order, using AND logic
 */
module.exports.hasAll = function (...requirements) {
	return (req, res, next) => {
		Promise.resolve(module.exports.requiresAll(requirements)(req))
			.then(() => {
				next();
			})
			.catch(next);
	};
};

module.exports.requiresAll = (requirements) => {
	return (req) => {
		// Apply the requirements
		const applyRequirement = (i) => {
			if (i < requirements.length) {
				return requirements[i](req).then((result) => {
					// Success means try the next one
					return applyRequirement(++i);
				});
			} else {
				// Once they all pass, we're good
				return Promise.resolve();
			}
		};

		return applyRequirement(0);
	};
};

/**
 * Apply the array of auth functions in order, using OR logic
 */
module.exports.hasAny = function (...requirements) {
	return (req, res, next) => {
		Promise.resolve(module.exports.requiresAny(requirements)(req))
			.then(() => {
				next();
			})
			.catch(next);
	};
};

module.exports.requiresAny = (requirements) => {
	return (req) => {
		// Apply the requirements
		let error;
		const applyRequirement = (i) => {
			if (i < requirements.length) {
				return requirements[i](req)
					.then(() => {
						// Success means we're done
						return Promise.resolve();
					})
					.catch((errorResult) => {
						// Failure means keep going
						error = errorResult;
						return applyRequirement(++i);
					});
			} else {
				// If we run out of requirements, fail with the last error
				return Promise.reject(error);
			}
		};

		if (requirements.length > 0) {
			return applyRequirement(0);
		}
		// Nothing to check passes
		return Promise.resolve();
	};
};

/**
 * Checks that the user has base access
 * 	1. The user is logged in
 * 	2. The user has accepted the EUA if applicable
 * 	3. The user has the 'user' role
 */
module.exports.hasAccess = (req, res, next) => {
	module.exports.hasAll(
		module.exports.requiresLogin,
		module.exports.requiresOrganizationLevels,
		module.exports.requiresUserRole,
		module.exports.requiresExternalRoles,
		euas.requiresEua
	)(req, res, next);
};

/**
 * Checks that the user has editor access
 * 	1. The user has met the base access requirements
 * 	2. The user has the 'editor' role
 */
module.exports.hasEditorAccess = (req, res, next) => {
	module.exports.hasAll(
		module.exports.requiresLogin,
		module.exports.requiresOrganizationLevels,
		module.exports.requiresUserRole,
		module.exports.requiresExternalRoles,
		module.exports.requiresEditorRole,
		euas.requiresEua
	)(req, res, next);
};

/**
 * Checks that the user has auditor access
 * 	1. The user has met the base access requirements
 * 	2. The user has the 'auditor' role
 */
module.exports.hasAuditorAccess = (req, res, next) => {
	module.exports.hasAll(
		module.exports.requiresLogin,
		module.exports.requiresOrganizationLevels,
		module.exports.requiresUserRole,
		module.exports.requiresExternalRoles,
		module.exports.requiresAuditorRole,
		euas.requiresEua
	)(req, res, next);
};

/**
 * Checks that the user has admin access
 * 	1. The user has met the base access requirements
 * 	2. The user has the 'admin' role
 */
module.exports.hasAdminAccess = (req, res, next) => {
	module.exports.hasAll(
		module.exports.requiresLogin,
		module.exports.requiresAdminRole
	)(req, res, next);
};
