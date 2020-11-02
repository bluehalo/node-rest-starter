'use strict';

const
	_ = require('lodash'),
	path = require('path'),
	deps = require('../../../../dependencies');

/**
 * ==========================================================
 * Private methods
 * ==========================================================
 */
const getProvider = () => {
	let provider;

	const erConfig = _.get(deps.config, 'auth.externalRoles');


	if (null != erConfig.provider) {
		provider = require(path.posix.resolve(erConfig.provider.file))(erConfig.provider.config);
	}

	if (null == provider) {
		throw new Error('No externalRoles provider configuration found.');
	}

	return provider;
};

const getRoleStrategy = () => _.get(deps.config, 'auth.roleStrategy', 'local');

const getRoles = () => _.get(deps.config, 'auth.roles', ['user', 'editor', 'auditor', 'admin']);

/**
 * ==========================================================
 * Public Methods
 * ==========================================================
 */

module.exports.hasRoles = (user, roles) => {
	const strategy = getRoleStrategy();

	let toReturn = true;

	if (null != roles) {
		const localRoles = user.roles || [];

		toReturn = roles.every((role) => {
			const hasLocalRole = localRoles[role];
			if (strategy === 'local') {
				return hasLocalRole;
			}

			const hasExternalRole = getProvider().hasRole(user, role);
			if (strategy === 'external') {
				return hasExternalRole;
			}

			return hasLocalRole || hasExternalRole;
		});
	}

	return toReturn;
};

module.exports.updateRoles = (user) => {
	const strategy = getRoleStrategy();
	const isHybrid = strategy === 'hybrid';

	if (isHybrid) {
		user.localRoles = user.roles || {};
	}
	if (strategy === 'external' || isHybrid) {
		const updatedRoles = {};
		for (const key of getRoles()) {
			updatedRoles[key] = (isHybrid && user.roles && user.roles[key]) || getProvider().hasRole(user, key);
		}
		user.roles = updatedRoles;
	}
};

module.exports.updateUserFilter = (query) => {
	// Update role filters based on roleStrategy
	const strategy = getRoleStrategy();
	const isExternal = strategy === 'external';

	if ((isExternal || strategy === 'hybrid') && query && query.$or) {
		for (const role of getRoles()) {
			if (query.$or.some((filter) => filter[`roles.${role}`])) {
				query.$or.push(getProvider().generateFilterForRole(role));
				if (isExternal) {
					_.remove(query.$or, (filter) => filter[`roles.${role}`]);
				}
			}
		}
	}

	return query;
};

module.exports.checkExternalRoles = (user, configAuth) => {
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

module.exports.validateAccessToPersonalResource = (user, resource) => {
	const isAdmin = null != user.roles && user.roles.admin === true;
	if (isAdmin || resource.creator.equals(user._id)) {
		return Promise.resolve();
	}
	return Promise.reject({ status: 403, type: 'unauthorized', message: 'The user does not have the necessary permissions to access this resource' });
};
