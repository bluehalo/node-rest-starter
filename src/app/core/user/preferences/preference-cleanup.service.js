'use strict';

const
	_ = require('lodash'),
	q = require('q'),

	deps = require('../../../../dependencies'),
	dbs = deps.dbs,
	logger = deps.logger,

	User = dbs.admin.model('User'),
	preferenceService = require('./preference.service');

/**
 * Query for multiple documents by ID and get results as a map from id -> result.
 * @param schema
 * @param ids
 * @param fieldsToReturn Optional array of fields to include in results. If empty will include all fields.
 * @param lean If true, will return as plain javascript objects instead of mongoose docs
 * @returns {Promise}
 */
const getAllByIdAsMap = function(ids, fieldsToReturn, lean) {
	fieldsToReturn = fieldsToReturn || [];

	const projection = {};
	fieldsToReturn.forEach((field) => {
		projection[field] = 1;
	});

	let promise = User.find( { _id: { $in: ids } }, projection );
	if (lean) {
		promise = promise.lean();
	}

	return promise.then((results) => _.keyBy(results, (result) => result._id));
};

/**
 * Clean up orphaned preferences (referenced user no longer exists)
 */
module.exports.run = function() {

	return preferenceService.searchAll({})
		.then((preferences) => {
			if (_.isArray(preferences)) {
				const userIds = _.uniqBy(preferences.map((preference) => preference.user), (id) => id.toString());
				return getAllByIdAsMap(userIds, ['_id'])
					.then((users) => {
						const removals = [];
						preferences.forEach((preference) => {
							if (users[preference.user] == null) {
								logger.debug(`Removing preference=${preference._id} owned by nonexistent user=${preference.user}`);
								removals.push(preference.remove());
							}
						});
						return q.all(removals);
					});
			}
			return q();
		})
		.fail((err) => {
			logger.error(`Failed scheduled run to clean up orphaned preferences. Error=${JSON.stringify(err)}`);
			return q.reject(err);
		});

};
