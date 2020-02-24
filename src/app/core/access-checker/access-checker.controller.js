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

	let page = req.query.page;
	let size = req.query.size;
	const sort = req.query.sort;
	let dir = req.query.dir;

	// Limit has to be at least 1 and no more than 100
	if(null == size){ size = 20; }
	size = Math.max(1, Math.min(100, size));

	// Page needs to be positive and has no upper bound
	if(null == page){ page = 0; }
	page = Math.max(0, page);

	// Sort can be null, but if it's non-null, dir defaults to DESC
	if(null != sort && dir == null){ dir = 'DESC'; }

	// Create the letiables to the search call
	const limit = size;
	const offset = page*size;
	let sortArr;
	if(null != sort){
		sortArr = [{ property: sort, direction: dir }];
	}

	CacheEntry.search(query, search, limit, offset, sortArr).then((result) => {

		// Create the return copy of the users
		const entries = [];
		result.results.forEach((element) => {
			entries.push(CacheEntry.fullCopy(element));
		});

		// success
		const toReturn = {
			totalSize: result.count,
			pageNumber: page,
			pageSize: size,
			totalPages: Math.ceil(result.count/size),
			elements: entries
		};

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

	let page = req.query.page;
	let size = req.query.size;
	const sort = req.query.sort;
	let dir = req.query.dir;

	// Limit has to be at least 1 and no more than 100
	if(null == size){ size = 20; }
	size = Math.max(1, Math.min(100, size));

	// Page needs to be positive and has no upper bound
	if(null == page){ page = 0; }
	page = Math.max(0, page);

	// Sort can be null, but if it's non-null, dir defaults to DESC
	if(null != sort && dir == null){ dir = 'ASC'; }

	// Create the letiables to the search call
	const limit = size;
	const offset = page*size;
	let sortArr;
	if(null != sort){
		sortArr = [{ property: sort, direction: dir }];
	}

	CacheEntry.containsQuery(query, ['key', 'valueString'], search, limit, offset, sortArr).then((result) => {

		// Create the return copy of the users
		const entries = [];
		result.results.forEach((element) => {
			entries.push(CacheEntry.fullCopy(element));
		});

		// success
		const toReturn = {
			totalSize: result.count,
			pageNumber: page,
			pageSize: size,
			totalPages: Math.ceil(result.count/size),
			elements: entries
		};

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
