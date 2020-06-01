'use strict';

const
	mongoose = require('mongoose'),
	pagingSearchPlugin = require('../../../common/mongoose/paging-search.plugin'),
	deps = require('../../../../dependencies'),
	util = deps.utilService,
	GetterSchema = deps.schemaService.GetterSchema;

/**
 * User Schema
 */
const UserAgreementSchema = new GetterSchema({
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
		get: util.dateParse
	},
	updated: {
		type: Date,
		get: util.dateParse
	},
	created: {
		type: Date,
		default: Date.now,
		get: util.dateParse
	}
});

UserAgreementSchema.plugin(pagingSearchPlugin);


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

//Get the most recent eua
const getCurrentEua = function() {
	return this.findOne({ 'published': { '$ne': null, '$exists': true } })
		.sort({ 'published': -1 })
		.exec();
};
UserAgreementSchema.statics.getCurrentEua = getCurrentEua;


//Copy a user for audit logging
UserAgreementSchema.statics.auditCopy = function(eua) {
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
