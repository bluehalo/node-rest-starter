'use strict';

const
	_ = require('lodash'),
	q = require('q');


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

module.exports.checkExternalRoles = function(user, configAuth) {
	// If there are required roles, check for them
	if (null != configAuth && _.isArray(configAuth.requiredRoles) && configAuth.requiredRoles.length > 0) {
		// Get the user roles
		let userRoles = (null != user && _.isArray(user.externalRoles)) ? user.externalRoles : [];
		if(_.difference(configAuth.requiredRoles, userRoles).length > 0) {
			return false;
		}
	}
	return true;
};

module.exports.validateAccessToPersonalResource = function(user, resource) {
	let isAdmin = null != user.roles && user.roles.admin === true;
	if (isAdmin || resource.creator.equals(user._id)) {
		return q();
	}
	return q.reject({ status: 403, type: 'unauthorized', message: 'The user does not have the necessary permissions to access this resource' });
};
