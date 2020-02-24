'use strict';

const
	q = require('q'),

	deps = require('../../../../dependencies'),
	dbs = deps.dbs,
	logger = deps.logger,

	accessChecker = require('../access-checker.service'),
	CacheEntry = dbs.admin.model('CacheEntry');


module.exports.run = function(svcConfig) {
	logger.debug('Access Checker: Checking cached users...');

	const refresh = svcConfig.refresh || 8*3600000; // default to 12 hours

	// Create a defer for the response
	const defer = q.defer();

	// Find all the keys that need to be refreshed
	CacheEntry.find({ ts: { $lt: Date.now() - refresh } }).exec((error, results) => {
		if(null != error) {
			defer.reject(error);
		} else {
			if(results.length > 0) {
				logger.info('Access Checker: Refreshing %s users', results.length);
			}

			// Iterate through each object, refreshing as you go
			const defers = [];
			results.forEach((e) => {
				logger.debug('Access Checker: Refreshing %s', e.key);
				defers.push(accessChecker.refreshEntry(e.key));
			});

			q.all(defers).then(defer.resolve, defer.reject).done();
		}
	});

	// return the promise
	return defer.promise;
};
