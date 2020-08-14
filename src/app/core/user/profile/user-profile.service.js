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

const updatePreferences = async (_id, pref) => {
	const user = await User.findById(_id);

	const preferences = user.preferences || {};
	Object.assign(preferences, pref);

	return user.update({$set: { preferences: preferences } }).exec();
};

const updateRequiredOrgs = (_id, requiredOrgs) => {
	return User.updateOne({ _id }, { $set: { organizationLevels: requiredOrgs } }).exec();
};

module.exports = {
	updatePreferences,
	updateRequiredOrgs
};
