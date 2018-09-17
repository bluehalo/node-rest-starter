'use strict';

const
	_ = require('lodash'),
	q = require('q'),

	deps = require('../../../../dependencies'),
	dbs = deps.dbs,
	logger = deps.logger,

	User = dbs.admin.model('User'),
	queryMongoService = require('../../../common/query.service'),
	preferenceService = require('./preference.service');

/**
 * Clean up orphaned preferences (referenced user no longer exists)
 */
module.exports.run = function() {

	return preferenceService.searchAll({})
		.then((preferences) => {
			if (_.isArray(preferences)) {
				let userIds = _.uniqBy(preferences.map((preference) => preference.user), (id) => id.toString());
				return queryMongoService.getAllByIdAsMap(User, userIds, ['_id'])
					.then((users) => {
						let removals = [];
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
