'use strict';

const _ = require('lodash'),
	mongoose = require('mongoose'),

	deps = require('../../../dependencies'),
	utilService = deps.utilService,

	GetterSchema = deps.schemaService.GetterSchema;

const ExportConfigSchema = new GetterSchema({
	type: {
		type: String,
		trim: true,
		default: '',
		required: 'Type is required'
	},

	config: {
		type: {},
		required: 'Configuration is required'
	},

	created: {
		type: Date,
		expires: 300,
		default: Date.now,
		get: utilService.dateParse,
		required: 'Created date is required'
	}
});

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
