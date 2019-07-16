'use strict';

const
	_ = require('lodash'),
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
		let viewPreferences = user.viewPreferences || {};

		[
			'sidebarOpen',
			'preferredResultsView',
			'hasTracked'
		]
		.forEach((prefKey) => {
			if (_.has(pref, prefKey)) {
				viewPreferences[prefKey] = pref[prefKey];
			}
		});

		return user.update({$set: { viewPreferences: viewPreferences } }).exec();
	});
};

module.exports.updateRequiredOrgs = (id, requiredOrgs) => {
	return User.update({ _id: id }, { $set: { organizationLevels: requiredOrgs } }).exec();
};

module.exports.userById = (id) => {
	let defer = q.defer();

	User.findOne({
		_id: id
	}).exec((err, user) => {
		if (err) {
			defer.reject(err);
		}
		else if (!user) {
			defer.reject(new Error('Failed to load User ' + id));
		}
		else {
			defer.resolve(user);
		}
	});

	return defer.promise;
};
