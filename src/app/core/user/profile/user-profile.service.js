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

module.exports.updatePreferences = (_id, pref) => {
	return User.findOne({ _id }).exec().then((user) => {
		const preferences = user.preferences || {};
		Object.assign(preferences, pref);

		return user.update({$set: { preferences: preferences } });
	});
};

module.exports.updateRequiredOrgs = (_id, requiredOrgs) => {
	return User.updateOne({ _id }, { $set: { organizationLevels: requiredOrgs } }).exec();
};

module.exports.userById = (_id) => {

	return User.findOne({ _id }).exec().then((user) => {
		if (!user) {
			return Promise.reject(new Error(`Failed to load User ${_id}`));
		}
		return user;
	});
};
