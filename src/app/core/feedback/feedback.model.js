'use strict';

const mongoose = require('mongoose'),

	deps = require('../../../dependencies'),
	util = deps.utilService,
	query = deps.queryService,

	GetterSchema = deps.schemaService.GetterSchema;

/**
 * Schema Declaration
 */
const FeedbackSchema = new GetterSchema({
	created: {
		type: Date,
		default: Date.now,
		get: util.dateParse
	},
	creator: {
		type: mongoose.Schema.ObjectId,
		ref: 'User'
	},
	body: { type: String },
	type: { type: String },
	url: { type: String },
	classification: { type: mongoose.Schema.Types.Mixed }
});

/**
 * Index declarations
 */

// Created datetime index, expires after 180 days
FeedbackSchema.index({ 'created': -1 }, { expireAfterSeconds: 15552000 });

// Type index
FeedbackSchema.index({ 'type': 'text' });

// User index
FeedbackSchema.index({ 'actor': 'text' });

// Text-search index
FeedbackSchema.index({ 'body': 'text', 'type': 'text' });

/*****************
 * Lifecycle hooks
 *****************/


/*****************
 * Static Methods
 *****************/

// Search feedback by text and other criteria
FeedbackSchema.statics.search = function(queryTerms, searchTerms, limit, offset, sortArr, runCount, populate) {
	return query.search(this, queryTerms, searchTerms, limit, offset, sortArr, runCount, populate);
};

/**
 * Register the Schema with Mongoose
 */
mongoose.model('Feedback', FeedbackSchema, 'feedback');
