'use strict';

const _ = require('lodash'),
	path = require('path'),
	deps = require('../../../../dependencies');

/**
 * ==========================================================
 * Private methods
 * ==========================================================
 */
const getProvider = () => {
	let provider;

	const erConfig = deps.config?.auth?.externalRoles;

	if (null != erConfig.provider) {
		provider = require(path.posix.resolve(erConfig.provider.file))(
			erConfig.provider.config
		);
	}

	if (null == provider) {
		throw new Error('No externalRoles provider configuration found.');
	}

	return provider;
};

const getRoleStrategy = () => deps.config?.auth?.roleStrategy ?? 'local';

const getRoles = () =>
	deps.config?.auth?.roles ?? ['user', 'editor', 'auditor', 'admin'];

/**
 * ==========================================================
 * Public Methods
 * ==========================================================
 */
module.exports.hasRole = (user, role) => {
	const strategy = getRoleStrategy();

	const localRoles = user.roles || {};

	const hasLocalRole = localRoles[role];
	if (strategy === 'local') {
		return hasLocalRole;
	}

	const hasExternalRole = getProvider().hasRole(user, role);
	if (strategy === 'external') {
		return hasExternalRole;
	}

	return hasLocalRole || hasExternalRole;
};

module.exports.hasRoles = (user, roles) => {
	if (null == roles || roles.length === 0) {
		return true;
	}

	return roles.every((role) => module.exports.hasRole(user, role));
};

module.exports.hasAnyRole = (user, roles) => {
	if (null == roles || roles.length === 0) {
		return true;
	}

	return roles.some((role) => module.exports.hasRole(user, role));
};

module.exports.updateRoles = (user) => {
	const strategy = getRoleStrategy();
	const isHybrid = strategy === 'hybrid';

	if (isHybrid) {
		user.localRoles = Object.assign({}, user.roles);
	}
	if (strategy === 'external' || isHybrid) {
		const updatedRoles = {};
		for (const key of getRoles()) {
			updatedRoles[key] =
				(isHybrid && user.roles && user.roles[key]) ||
				getProvider().hasRole(user, key);
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

module.exports.validateAccessToPersonalResource = (user, resource) => {
	const isAdmin = null != user.roles && user.roles.admin === true;
	if (isAdmin || resource.creator.equals(user._id)) {
		return Promise.resolve();
	}
	return Promise.reject({
		status: 403,
		type: 'unauthorized',
		message:
			'The user does not have the necessary permissions to access this resource'
	});
};
