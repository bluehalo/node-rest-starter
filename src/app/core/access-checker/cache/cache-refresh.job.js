'use strict';

const deps = require('../../../../dependencies'),
	dbs = deps.dbs,
	logger = deps.logger,
	accessChecker = require('../access-checker.service'),
	CacheEntry = dbs.admin.model('CacheEntry');

/**
 * @param {import('agenda').Job} job
 * @returns {Promise<void>}
 */
module.exports.run = async (job) => {
	const refresh = job.attrs.data.refresh ?? 8 * 3600000; // default to 8 hours;

	// Find all the keys that need to be refreshed
	const results = await CacheEntry.find({
		ts: { $lt: Date.now() - refresh }
	}).exec();

	logger.info('[cache-refresh]: Refreshing %s users', results.length);

	// Iterate through each object, refreshing as you go
	const refreshes = results.map((e) => {
		logger.debug('[cache-refresh] Refreshing %s', e.key);
		return accessChecker.refreshEntry(e.key);
	});

	await Promise.all(refreshes);
};
