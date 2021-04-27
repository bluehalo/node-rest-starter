'use strict';

const deps = require('../../../dependencies'),
	dbs = deps.dbs,
	util = deps.utilService,
	logger = deps.logger,
	accessCheckerService = require('./access-checker.service'),
	CacheEntry = dbs.admin.model('CacheEntry');

/**
 * Public methods
 */
module.exports.searchEntries = async (req, res) => {
	// Handle the query/search/page
	const query = req.body.q;
	const search = req.body.s;

	const page = util.getPage(req.query);
	const limit = util.getLimit(req.query);
	const sort = util.getSortObj(req.query, 'DESC');

	try {
		const results = await CacheEntry.find(query)
			.textSearch(search)
			.sort(sort)
			.paginate(limit, page);

		// Create the return copy of the users
		results.elements = results.elements.map((element) =>
			CacheEntry.fullCopy(element)
		);

		res.json(results);
	} catch (error) {
		// failure
		logger.error(error);
		return util.send400Error(res, error);
	}
};

// Match users given a search fragment
exports.matchEntries = async (req, res) => {
	// Handle the query/search/page
	const query = req.body.q;
	const search = req.body.s;

	const page = util.getPage(req.query);
	const limit = util.getLimit(req.query);
	const sort = util.getSortObj(req.query);
	const offset = page * limit;

	try {
		const results = await CacheEntry.find(query)
			.containsSearch(search)
			.sort(sort)
			.paginate(limit, page);

		// Create the return copy of the cache entry
		results.elements = results.elements.map((element) =>
			CacheEntry.fullCopy(element)
		);

		res.json(results);
	} catch (error) {
		// failure
		logger.error(error);
		return util.send400Error(res, error);
	}
};

exports.refreshEntry = function (req, res) {
	if (null == req.params.key) {
		util.handleErrorResponse(res, {
			status: 400,
			type: 'bad-request',
			message: "Missing 'key' request argument"
		});
	} else {
		accessCheckerService
			.refreshEntry(req.params.key)
			.then(() => {
				res.status(204).end();
			})
			.catch((error) => {
				util.handleErrorResponse(res, {
					status: 500,
					type: 'error',
					message: error
				});
			});
	}
};

exports.deleteEntry = function (req, res) {
	if (null == req.params.key) {
		util.handleErrorResponse(res, {
			status: 400,
			type: 'bad-request',
			message: "Missing 'key' request argument"
		});
	} else {
		accessCheckerService
			.deleteEntry(req.params.key)
			.then(() => {
				res.status(204).end();
			})
			.catch((error) => {
				util.handleErrorResponse(res, {
					status: 500,
					type: 'error',
					message: error
				});
			});
	}
};

exports.refreshCurrentUser = function (req, res) {
	const key =
		null != req.user && null != req.user.providerData
			? req.user.providerData.dnLower
			: undefined;
	accessCheckerService
		.refreshEntry(key)
		.then(() => {
			res.status(204).end();
		})
		.catch((error) => {
			util.handleErrorResponse(res, {
				status: 500,
				type: 'error',
				message: error
			});
		});
};
