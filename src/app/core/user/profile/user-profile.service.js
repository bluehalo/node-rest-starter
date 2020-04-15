'use strict';

const
	q = require('q'),

	deps = require('../../../../dependencies'),
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

module.exports.updatePreferences = (id, pref) => {
	return User.findOne({ _id: id }).then((user) => {
		const preferences = user.preferences || {};
		Object.assign(preferences, pref);

		return user.update({$set: { preferences: preferences } }).exec();
	});
};

module.exports.updateRequiredOrgs = (id, requiredOrgs) => {
	return User.updateOne({ _id: id }, { $set: { organizationLevels: requiredOrgs } }).exec();
};

module.exports.userById = (id) => {
	const defer = q.defer();

	User.findOne({
		_id: id
	}).exec((err, user) => {
		if (err) {
			defer.reject(err);
		}
		else if (!user) {
			defer.reject(new Error(`Failed to load User ${id}`));
		}
		else {
			defer.resolve(user);
		}
	});

	return defer.promise;
};
