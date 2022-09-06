'use strict';

const _ = require('lodash'),
	mongoose = require('mongoose'),
	deps = require('../../../dependencies'),
	utilService = deps.utilService,
	getterPlugin = require('../../common/mongoose/getter.plugin');

const ExportConfigSchema = new mongoose.Schema({
	type: {
		type: String,
		trim: true,
		default: '',
		required: [true, 'Type is required']
	},

	config: {
		type: {},
		required: [true, 'Configuration is required']
	},

	created: {
		type: Date,
		expires: 300,
		default: () => Date.now(),
		get: utilService.dateParse,
		required: [true, 'Created date is required']
	}
});
ExportConfigSchema.plugin(getterPlugin);

ExportConfigSchema.statics.auditCopy = (exportConfig) => {
	const toReturn = {};
	exportConfig = exportConfig || {};

	toReturn._id = exportConfig._id;
	toReturn.type = exportConfig.type;
	toReturn.config = _.cloneDeep(exportConfig.config);

	return toReturn;
};

/**
 * Model Registration
 */
mongoose.model('ExportConfig', ExportConfigSchema);
