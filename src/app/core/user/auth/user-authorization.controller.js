'use strict';

const
	_ = require('lodash'),

	deps = require('../../../../dependencies'),
	config = deps.config,
	dbs = deps.dbs,

	userProfileService = require('../profile/user-profile.service'),
	userAuthService = require('./user-authentication.service'),
	User = dbs.admin.model('User');


/**
 * Exposed API
 */

// User middleware - stores user corresponding to id in 'userParam'
module.exports.userById = (req, res, next, id) => {
	userProfileService.userById(id)
		.then((user) => {
			req.userParam = user;
			next();
		}).catch((err) => {
			next(err);
		});
};


/**
 * Require an authenticated user
 */
module.exports.requiresLogin = (req) => {
	if (req.isAuthenticated()) {
		return Promise.resolve();
	} else {

		// Only try to auto login if it's explicitly set in the config
		if(config.auth.autoLogin) {
			return userAuthService.authenticateAndLogin(req);
		}
		// Otherwise don't
		else {
			return Promise.reject({ status: 401, type: 'no-login', message: 'User is not logged in' });
		}
	}
};

/**
 * Require the passed roles
 */
module.exports.requiresRoles = (roles, rejectStatus) => {
	rejectStatus = rejectStatus || { status: 403, type: 'missing-roles', message: 'User is missing required roles' };

	return (req) => {
		const strategy = _.get(config, 'auth.roleStrategy', 'local');
		if (strategy === 'local' || strategy === 'hybrid') {
			if (User.hasRoles(req.user, roles)) {
				return Promise.resolve();
			}
		}

		if (strategy === 'external' || strategy === 'hybrid') {
			const requiredRoles = roles.map((role) => config.auth.externalRoleMap[role]);
			return module.exports.requiresExternalRoles(req, requiredRoles);
		}

		return Promise.reject(rejectStatus);
	};
};

//Detects if the user has the user role
module.exports.requiresUserRole = (req) => {
	return module.exports.requiresRoles(
			['user'],
			{ status: 403, type: 'inactive', message: 'User account is inactive'}
		)(req);
};

//Detects if the user has the editor role
module.exports.requiresEditorRole = (req) => {
	return module.exports.requiresRoles(['editor'])(req);
};

//Detects if the user has the auditor role
module.exports.requiresAuditorRole = (req) => {
	return module.exports.requiresRoles(['auditor'])(req);
};

// Detects if the user has admin role
module.exports.requiresAdminRole = (req) => {
	return module.exports.requiresRoles(['admin'])(req);
};

// Checks to see if all required external roles are accounted for
module.exports.requiresExternalRoles = (req, requiredRoles) => {
	requiredRoles = requiredRoles || config.auth.requiredRoles;

	let promise;

	// If there are required roles, check for them
	if(req.user.bypassAccessCheck === false && null != config.auth && _.isArray(requiredRoles) && requiredRoles.length > 0) {

		// Get the user roles
		const userRoles = (null != req.user && _.isArray(req.user.externalRoles))? req.user.externalRoles : [];

		// Reject if the user is missing required roles
		if (_.difference(requiredRoles, userRoles).length > 0) {
			promise = Promise.reject({ status: 403, type: 'noaccess', message: 'User is missing required roles' });
		}
		// Resolve if they had all the roles
		else {
			promise = Promise.resolve();
		}
	}
	// Resolve if we don't need to check
	else {
		promise = Promise.resolve();
	}

	return promise;
};

module.exports.runAsExternalId = function(req, res, next) {
	req.user = req.userParam;
	return Promise.resolve();
};

/**
 * Checks whether user has defined organization level values if values are required
 */
module.exports.requiresOrganizationLevels = (req) => {
	const required = _.get(config, 'orgLevelConfig.required', false);

	if (!required) {
		// Organization levels are not required, proceed
		return Promise.resolve();
	}

	if (User.hasRoles(req.user, ['admin'])) {
		// Admins can bypass this requirement
		return Promise.resolve();
	}

	return (!_.isEmpty(req.user.organizationLevels)) ? Promise.resolve() : Promise.reject({ status: 403, type: 'requiredOrg', message: 'User must select organization levels.'});
};
