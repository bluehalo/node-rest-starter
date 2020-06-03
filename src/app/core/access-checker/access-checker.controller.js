'use strict';

const
	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	util = deps.utilService,
	logger = deps.logger,

	accessCheckerService = require('./access-checker.service'),
	CacheEntry = dbs.admin.model('CacheEntry');


/**
 * Public methods
 */
module.exports.searchEntries = function(req, res) {

	// Handle the query/search/page
	const query = req.body.q;
	const search = req.body.s;

	const page = util.getPage(req.query);
	const limit = util.getLimit(req.query);
	const sortArr = util.getSort(req.query, 'DESC');
	const offset = page * limit;

	CacheEntry.textSearch(query, search, limit, offset, sortArr).then((result) => {

		// Create the return copy of the users
		const entries = [];
		result.results.forEach((element) => {
			entries.push(CacheEntry.fullCopy(element));
		});

		// success
		const toReturn = util.getPagingResults(limit, page, result.count, entries);

		// Serialize the response
		res.json(toReturn);
	}, (error) => {
		// failure
		logger.error(error);
		return util.send400Error(res, error);
	});
};



// Match users given a search fragment
exports.matchEntries = function(req, res) {
	// Handle the query/search/page
	const query = req.body.q;
	const search = req.body.s;

	const page = util.getPage(req.query);
	const limit = util.getLimit(req.query);
	const sortArr = util.getSort(req.query);
	const offset = page * limit;

	CacheEntry.containsSearch(query, ['key', 'valueString'], search, limit, offset, sortArr).then((result) => {

		// Create the return copy of the users
		const entries = [];
		result.results.forEach((element) => {
			entries.push(CacheEntry.fullCopy(element));
		});

		// success
		const toReturn = util.getPagingResults(limit, page, result.count, entries);

		// Serialize the response
		res.json(toReturn);
	}, (error) => {
		// failure
		logger.error(error);
		return util.send400Error(res, error);
	});
};

exports.refreshEntry = function(req, res) {
	if(null == req.params.key) {
		util.handleErrorResponse(res, { status: 400, type: 'bad-request', message: 'Missing \'key\' request argument' });
	}
	else {
		accessCheckerService.refreshEntry(req.params.key).then(() => {
			res.status(204).end();
		}, (error) => {
			util.handleErrorResponse(res, { status: 500, type: 'error', message: error });
		});
	}
};

exports.deleteEntry = function(req, res) {
	if(null == req.params.key) {
		util.handleErrorResponse(res, { status: 400, type: 'bad-request', message: 'Missing \'key\' request argument' });
	}
	else {
		accessCheckerService.deleteEntry(req.params.key).then(() => {
			res.status(204).end();
		}, (error) => {
			util.handleErrorResponse(res, { status: 500, type: 'error', message: error });
		});
	}
};

exports.refreshCurrentUser = function(req, res) {
	const key = (null != req.user && null != req.user.providerData)? req.user.providerData.dnLower: undefined;
	accessCheckerService.refreshEntry(key).then(() => {
		res.status(204).end();
	}, (error) => {
		util.handleErrorResponse(res, { status: 500, type: 'error', message: error });
	});
};
