'use strict';

const _ = require('lodash'),
	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	logger = deps.logger,
	util = deps.utilService,
	Audit = dbs.admin.model('Audit');

/**
 * Retrieves the distinct values for a field in the Audit collection
 */
exports.getDistinctValues = function (req, res) {
	const fieldToQuery = req.query.field;

	Audit.distinct(fieldToQuery, {}).exec((err, results) => {
		if (null != err) {
			// failure
			logger.error({ err: err, req: req }, 'Error finding distinct values');
			return util.send400Error(res, err);
		}

		res.json(results);
	});
};

exports.search = async function (req, res) {
	const search = req.body.s || null;
	let query = req.body.q || {};
	query = util.toMongoose(query);

	const page = util.getPage(req.query);
	const limit = util.getLimit(req.query);
	const sort = util.getSortObj(req.query, 'DESC', '_id');

	try {
		const result = await Audit.find(query)
			.containsSearch(search)
			.sort(sort)
			.paginate(limit, page);

		// If any audit objects are strings, try to parse them as json. we may have stringified objects because mongo
		// can't support keys with dots
		result.elements = result.elements.map((doc) => {
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

		// Serialize the response
		res.status(200).json(result);
	} catch (err) {
		// failure
		logger.error({ err: err, req: req }, 'Error searching for audit entries');
		return util.handleErrorResponse(res, err);
	}
};
