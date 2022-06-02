'use strict';

const deps = require('../../../dependencies'),
	dbs = deps.dbs,
	util = deps.utilService,
	accessCheckerService = require('./access-checker.service'),
	CacheEntry = dbs.admin.model('CacheEntry');

/**
 * Public methods
 */
// Match users given a search fragment
exports.matchEntries = async (req, res) => {
	// Handle the query/search/page
	const query = req.body.q;
	const search = req.body.s;

	const page = util.getPage(req.query);
	const limit = util.getLimit(req.query);
	const sort = util.getSortObj(req.query);

	const results = await CacheEntry.find(query)
		.containsSearch(search)
		.sort(sort)
		.paginate(limit, page);

	// Create the return copy of the cache entry
	results.elements = results.elements.map((element) =>
		CacheEntry.fullCopy(element)
	);

	res.json(results);
};

module.exports.refreshEntry = async (req, res) => {
	await accessCheckerService.refreshEntry(req.params.key);
	res.status(204).end();
};

module.exports.deleteEntry = async (req, res) => {
	await accessCheckerService.deleteEntry(req.params.key);
	res.status(204).end();
};

module.exports.refreshCurrentUser = async (req, res) => {
	await accessCheckerService.refreshEntry(req.user?.providerData?.dnLower);
	res.status(204).end();
};
