'use strict';

const
	_ = require('lodash'),

	deps = require('../../../../dependencies'),
	config = deps.config,
	dbs = deps.dbs,

	userService = require('../user.service'),
	userAuthService = require('./user-authentication.service'),
	User = dbs.admin.model('User');

/**
 * Exposed API
 */

// User middleware - stores user corresponding to id in 'userParam'
module.exports.userById = async (req, res, next, id) => {
	const user = await userService.read(id);
	if (!user) {
		return next(new Error(`Failed to load User ${id}`));
	}
	req.userParam = user;
	return next();
};


/**
 * Require an authenticated user
 */
module.exports.requiresLogin = (req) => {
	if (req.isAuthenticated()) {
		return Promise.resolve();
	}

	// Only try to auto login if it's explicitly set in the config
	if (config.auth.autoLogin) {
		return userAuthService.authenticateAndLogin(req);
	}
	// Otherwise don't
	return Promise.reject({ status: 401, type: 'no-login', message: 'User is not logged in' });
};

/**
 * Require the passed roles
 */
module.exports.requiresRoles = (roles, rejectStatus) => {
	rejectStatus = rejectStatus || { status: 403, type: 'missing-roles', message: 'User is missing required roles' };

	return (req) => {
		const strategy = _.get(config, 'auth.roleStrategy', 'local');
		if ((strategy === 'local' || strategy === 'hybrid') && User.hasRoles(req.user, roles)) {
			return Promise.resolve();
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

	// If there are required roles, check for them
	if(req.user.bypassAccessCheck === false && null != config.auth && _.isArray(requiredRoles) && requiredRoles.length > 0) {
		// Get the user roles
		const userRoles = (null != req.user && _.isArray(req.user.externalRoles))? req.user.externalRoles : [];

		// Reject if the user is missing required roles
		if (_.difference(requiredRoles, userRoles).length > 0) {
			return Promise.reject({ status: 403, type: 'noaccess', message: 'User is missing required roles' });
		}
		// Resolve if they had all the roles
		return Promise.resolve();
	}
	// Resolve if we don't need to check
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
