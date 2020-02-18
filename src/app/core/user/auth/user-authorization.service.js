'use strict';

const
	_ = require('lodash');


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
module.exports.hasRoles = (user, roles, authConfig) => {
	const strategy = _.get(authConfig, 'roleStrategy', 'local');

	let toReturn = true;

	if (null != roles) {
		const localRoles = user.roles || [];
		const externalRoles = user.externalRoles || [];

		toReturn = roles.every((role) => {
			const hasLocalRole = localRoles[role];
			if (strategy === 'local')
				return hasLocalRole;

			const hasExternalRole = externalRoles.indexOf(authConfig.externalRoleMap[role]) !== -1;
			if (strategy === 'external')
				return hasExternalRole;

			return hasLocalRole || hasExternalRole;
		});
	}

	return toReturn;
};

module.exports.updateRoles = (user, authConfig) => {
	const strategy = _.get(authConfig, 'roleStrategy', 'local');
	const isHybrid = strategy === 'hybrid';

	if (isHybrid) {
		user.localRoles = user.roles || {};
	}
	if (strategy === 'external' || isHybrid) {
		const updatedRoles = {};
		const externalRoles = user.externalRoles || [];
		const externalRoleMap = authConfig.externalRoleMap;

		const keys = _.keys(externalRoleMap);

		keys.forEach((key) => {
			updatedRoles[key] = (isHybrid && user.roles && user.roles[key]) || externalRoles.indexOf(externalRoleMap[key]) !== -1;
		});

		user.roles = updatedRoles;
	}
};

module.exports.checkExternalRoles = function(user, configAuth) {
	// If there are required roles, check for them
	if (null != configAuth && _.isArray(configAuth.requiredRoles) && configAuth.requiredRoles.length > 0) {
		// Get the user roles
		const userRoles = (null != user && _.isArray(user.externalRoles)) ? user.externalRoles : [];
		if(_.difference(configAuth.requiredRoles, userRoles).length > 0) {
			return false;
		}
	}
	return true;
};

module.exports.validateAccessToPersonalResource = function(user, resource) {
	const isAdmin = null != user.roles && user.roles.admin === true;
	if (isAdmin || resource.creator.equals(user._id)) {
		return Promise.resolve();
	}
	return Promise.reject({ status: 403, type: 'unauthorized', message: 'The user does not have the necessary permissions to access this resource' });
};
