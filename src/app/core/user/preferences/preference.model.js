'use strict';

const mongoose = require('mongoose'),
	paginatePlugin = require('../../../common/mongoose/paginate.plugin');

/**
 * Preference Schema
 */
module.exports.preferenceOptions = {
	discriminatorKey: 'preferenceType',
	timestamps: {
		createdAt: 'created',
		updatedAt: 'updated'
	}
};

const PreferenceSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'User is required']
		}
	},
	module.exports.preferenceOptions
);

PreferenceSchema.plugin(paginatePlugin);

/**
 * Index declarations
 */

PreferenceSchema.index({ user: 1, updated: -1 });
PreferenceSchema.index({ user: 1, preferenceType: 1, updated: -1 });

/**
 * Static Methods
 */

// Create a filtered copy for auditing
PreferenceSchema.statics.auditCopy = function (src) {
	const toReturn = {};
	src = src || {};

	toReturn._id = src._id;
	toReturn.user = src.user;
	toReturn.preferenceType = src.preferenceType;

	return toReturn;
};

/**
 * Model Registration
 */
mongoose.model('Preference', PreferenceSchema, 'preferences');
