'use strict';

const _ = require('lodash'),
	mongoose = require('mongoose'),
	getterPlugin = require('../../common/mongoose/getter.plugin');

const ExportConfigSchema = new mongoose.Schema(
	{
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
			required: [true, 'Created date is required']
		}
	},
	{
		timestamps: {
			createdAt: 'created',
			updatedAt: false
		}
	}
);
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
