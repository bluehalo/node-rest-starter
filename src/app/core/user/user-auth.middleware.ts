import _ from 'lodash';

import userAuthService from './auth/user-authentication.service';
import userAuthorizationService from './auth/user-authorization.service';
import { requiresEua } from './eua/eua.controller';
import { config } from '../../../dependencies';
import { ForbiddenError, UnauthorizedError } from '../../common/errors';
import { has, hasAll, requiresAny } from '../../common/express/auth-middleware';

/**
 * Checks that the user is logged in
 * 	1. The user is logged in
 */
export const hasLogin = (req, res, next) => {
	has(requiresLogin)(req, res, next);
};

/**
 * Checks that the user has base access
 * 	1. The user is logged in
 * 	2. The user has accepted the EUA if applicable
 * 	3. The user has the 'user' role
 */
export const hasAccess = (req, res, next) => {
	hasAll(
		requiresLogin,
		requiresOrganizationLevels,
		requiresAny([requiresUserRole, requiresMachineRole]),
		requiresExternalRoles,
		requiresEua
	)(req, res, next);
};

/**
 * Checks that the user has editor access
 * 	1. The user has met the base access requirements
 * 	2. The user has the 'editor' role
 */
export const hasEditorAccess = (req, res, next) => {
	hasAll(
		requiresLogin,
		requiresOrganizationLevels,
		requiresAny([requiresUserRole, requiresMachineRole]),
		requiresExternalRoles,
		requiresAny([requiresAdminRole, requiresEditorRole]),
		requiresEua
	)(req, res, next);
};

/**
 * Checks that the user has auditor access
 * 	1. The user has met the base access requirements
 * 	2. The user has the 'auditor' role
 */
export const hasAuditorAccess = (req, res, next) => {
	hasAll(
		requiresLogin,
		requiresOrganizationLevels,
		requiresUserRole,
		requiresExternalRoles,
		requiresAuditorRole,
		requiresEua
	)(req, res, next);
};

/**
 * Checks that the user has admin access
 * 	1. The user has met the base access requirements
 * 	2. The user has the 'admin' role
 */
export const hasAdminAccess = (req, res, next) => {
	hasAll(requiresLogin, requiresAdminRole)(req, res, next);
};

/**
 * Require an authenticated user
 */
export const requiresLogin = (req, res, next) => {
	if (req.isAuthenticated()) {
		return Promise.resolve();
	}

	// Only try to auto login if it's explicitly set in the config
	if (config.get<boolean>('auth.autoLogin')) {
		return userAuthService.authenticateAndLogin(req, res, next);
	}
	// Otherwise don't
	return Promise.reject(new UnauthorizedError('User is not logged in'));
};

/**
 * Require the passed roles
 */
export const requiresRoles = (
	roles: string[],
	errorMessage = 'User is missing required roles'
) => {
	return (req) => {
		if (userAuthorizationService.hasRoles(req.user, roles)) {
			return Promise.resolve();
		}
		return Promise.reject(new ForbiddenError(errorMessage));
	};
};

//Detects if the user has the user role
export const requiresUserRole = (req) => {
	return requiresRoles(['user'], 'User account is inactive')(req);
};

//Detects if the user has the editor role
export const requiresEditorRole = (req) => {
	return requiresRoles(['editor'])(req);
};

//Detects if the user has the auditor role
export const requiresAuditorRole = (req) => {
	return requiresRoles(['auditor'])(req);
};

// Detects if the user has admin role
export const requiresAdminRole = (req) => {
	return requiresRoles(['admin'])(req);
};

//Detects if the user has the machine role
export const requiresMachineRole = (req) => {
	return requiresRoles(['machine'])(req);
};

// Checks to see if all required external roles are accounted for
export const requiresExternalRoles = (req) => {
	const requiredRoles = config.get<string[]>('auth.requiredRoles');

	// If there are required roles, check for them
	if (req.user.bypassAccessCheck === false && requiredRoles.length > 0) {
		// Get the user roles
		const userRoles = _.isArray(req.user.externalRoles)
			? req.user.externalRoles
			: [];

		// Reject if the user is missing required roles
		if (_.difference(requiredRoles, userRoles).length > 0) {
			return Promise.reject(
				new ForbiddenError('User is missing required external roles')
			);
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
export const requiresOrganizationLevels = (req) => {
	const required = config.get('orgLevelConfig.required');

	if (!required) {
		// Organization levels are not required, proceed
		return Promise.resolve();
	}

	if (userAuthorizationService.hasRoles(req.user, ['admin'])) {
		// Admins can bypass this requirement
		return Promise.resolve();
	}

	return !_.isEmpty(req.user.organizationLevels)
		? Promise.resolve()
		: Promise.reject(
				new ForbiddenError('User must select organization levels.')
		  );
};
