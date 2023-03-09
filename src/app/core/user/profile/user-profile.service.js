'use strict';

const deps = require('../../../../dependencies'),
	dbs = deps.dbs,
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

const updatePreferences = async (user, pref) => {
	user.preferences = { ...user.preferences, ...pref };

	return user.save();
};

const updateRequiredOrgs = (user, requiredOrgs) => {
	user.organizationLevels = requiredOrgs;
	return user.save();
};

module.exports = {
	updatePreferences,
	updateRequiredOrgs
};
