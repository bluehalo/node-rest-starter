'use strict';

const deps = require('../../../../dependencies'),
	dbs = deps.dbs,
	logger = deps.logger,

	accessChecker = require('../access-checker.service'),
	CacheEntry = dbs.admin.model('CacheEntry');

module.exports.run = async (svcConfig) => {
	logger.debug('Access Checker: Checking cached users...');

	const refresh = svcConfig.refresh || 8*3600000; // default to 8 hours

	// Find all the keys that need to be refreshed
	const results = await CacheEntry.find({ ts: { $lt: Date.now() - refresh } }).exec();

	if(results.length > 0) {
		logger.info('Access Checker: Refreshing %s users', results.length);
	}

	// Iterate through each object, refreshing as you go
	const refreshes = results.map((e) => {
		logger.debug('Access Checker: Refreshing %s', e.key);
		return accessChecker.refreshEntry(e.key);
	});

	return Promise.all(refreshes);
};
