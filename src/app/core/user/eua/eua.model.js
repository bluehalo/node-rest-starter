'use strict';

const mongoose = require('mongoose'),
	getterPlugin = require('../../../common/mongoose/getter.plugin'),
	{ paginatePlugin } = require('../../../common/mongoose/paginate.plugin'),
	{ textSearchPlugin } = require('../../../common/mongoose/text-search.plugin'),
	deps = require('../../../../dependencies'),
	util = deps.utilService;

/**
 * User Schema
 */
const UserAgreementSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			trim: true,
			default: '',
			validate: [util.validateNonEmpty, 'Please provide a title']
		},
		text: {
			type: String,
			trim: true,
			default: '',
			validate: [util.validateNonEmpty, 'Please provide text']
		},
		published: {
			type: Date,
			default: null
		}
	},
	{
		timestamps: {
			createdAt: 'created',
			updatedAt: 'updated'
		}
	}
);
UserAgreementSchema.plugin(getterPlugin);
UserAgreementSchema.plugin(paginatePlugin);
UserAgreementSchema.plugin(textSearchPlugin);

/**
 * Index declarations
 */
UserAgreementSchema.index({ title: 'text', text: 'text' });

/**
 * Lifecycle Hooks
 */

/**
 * Instance Methods
 */

/**
 * Static Methods
 */

//Copy a user for audit logging
UserAgreementSchema.statics.auditCopy = function (eua) {
	const newEua = {};
	eua = eua || {};

	newEua._id = eua._id;
	newEua.title = eua.title;
	newEua.text = eua.text;
	newEua.published = eua.published;
	newEua.created = eua.created;
	newEua.updated = eua.updated;

	return newEua;
};

/**
 * Model Registration
 */
mongoose.model('UserAgreement', UserAgreementSchema);
