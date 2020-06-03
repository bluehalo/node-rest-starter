'use strict';

const
	_ = require('lodash'),

	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	logger = deps.logger,
	util = deps.utilService,

	Audit = dbs.admin.model('Audit');

/**
 * Retrieves the distinct values for a field in the Audit collection
 */
exports.getDistinctValues = function(req, res) {
	const fieldToQuery = req.query.field;

	Audit.distinct(fieldToQuery, {}).exec((err, results) => {
		if(null != err) {
			// failure
			logger.error({err: err, req: req}, 'Error finding distinct values');
			return util.send400Error(res, err);
		}

		res.json(results);
	});
};

exports.search = function(req, res) {
	const search = req.body.s || null;
	let query = req.body.q || {};
	query = util.toMongoose(query);

	const page = util.getPage(req.query);
	const limit = util.getLimit(req.query);
	const sortArr = util.getSort(req.query, 'DESC', '_id');
	const offset = page * limit;

	Audit.textSearch(query, search, limit, offset, sortArr).then((result) => {
		// If any audit objects are strings, try to parse them as json. we may have stringified objects because mongo
		// can't support keys with dots
		const results = result.results.map((doc) => {
			if (_.isString(doc.audit.object)) {
				try {
					doc.audit.object = JSON.parse(doc.audit.object);
					return doc;
				} catch (e) {
					// ignore
					return doc;
				}
			}
			return doc;
		});

		// success
		const toReturn = util.getPagingResults(page, limit, result.count, results);

		// Serialize the response
		res.status(200).json(toReturn);
	}, (err) => {
		// failure
		logger.error({err: err, req: req}, 'Error searching for audit entries');
		return util.handleErrorResponse(res, err);
	});
};
