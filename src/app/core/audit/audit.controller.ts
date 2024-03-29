import { StatusCodes } from 'http-status-codes';
import _ from 'lodash';
import { FilterQuery } from 'mongoose';

import { Audit, AuditDocument } from './audit.model';
import { config, utilService as util } from '../../../dependencies';
import { Callbacks } from '../export/callbacks';
import * as exportConfigController from '../export/export-config.controller';
import { IExportConfig } from '../export/export-config.model';

/**
 * Retrieves the distinct values for a field in the Audit collection
 */
export const getDistinctValues = async (req, res) => {
	const results = await Audit.distinct(req.query.field, {});
	res.status(StatusCodes.OK).json(results);
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
	res.status(StatusCodes.OK).json(result);
};

export const getCSV = (req, res) => {
	const exportConfig = req.exportConfig as IExportConfig;
	const exportQuery = util.toMongoose(
		req.exportQuery
	) as FilterQuery<AuditDocument>;

	const fileName = `${config.get('app.instanceName')}-${exportConfig.type}.csv`;

	const columns = exportConfig.config.cols;

	columns.forEach((col) => {
		col.title = col.title ?? _.capitalize(col.key);

		switch (col.key) {
			case 'created':
				col.callback = Callbacks.formatDate(`yyyy-LL-dd HH:mm:ss`);
				break;
			case 'audit.actor':
				col.callback = Callbacks.getValueProperty('name');
				break;
		}
	});

	const sort = util.getSortObj(exportConfig.config, 'DESC', '_id');

	const cursor = Audit.find(exportQuery)
		.containsSearch(exportConfig.config.s)
		.sort(sort)
		.cursor();

	exportConfigController.exportCSV(req, res, fileName, columns, cursor);
};
