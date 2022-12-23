import _ from 'lodash';

import { dbs, utilService as util } from '../../../dependencies';
import { AuditModel } from './audit.model';

const Audit: AuditModel = dbs.admin.model('Audit');

/**
 * Retrieves the distinct values for a field in the Audit collection
 */
export const getDistinctValues = async (req, res) => {
	const results = await Audit.distinct(req.query.field, {});
	res.status(200).json(results);
};

export const search = async function (req, res) {
	const search = req.body.s || null;
	let query = req.body.q || {};
	query = util.toMongoose(query);

	const page = util.getPage(req.query);
	const limit = util.getLimit(req.query);
	const sort = util.getSortObj(req.query, 'DESC', '_id');

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
};
