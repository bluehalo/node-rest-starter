'use strict';

const
	mongoose = require('mongoose'),
	pagingSearchPlugin = require('../../common/mongoose/paging-search.plugin'),
	deps = require('../../../dependencies'),
	util = deps.utilService,

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
	os: { type: String },
	browser: { type: String },
	classification: { type: String }
});

FeedbackSchema.plugin(pagingSearchPlugin);

/**
 * Index declarations
 */

// Created datetime index, expires after 180 days
FeedbackSchema.index({ 'created': -1 }, { expireAfterSeconds: 15552000 });

FeedbackSchema.index({ 'type': 1 });
FeedbackSchema.index({ 'creator': 1 });
FeedbackSchema.index({ 'url': 1 });
FeedbackSchema.index({ 'os': 1 });
FeedbackSchema.index({ 'browser': 1 });

// Text-search index
FeedbackSchema.index({ 'body': 'text' });

/*****************
 * Lifecycle hooks
 *****************/


/*****************
 * Static Methods
 *****************/

/**
 * Register the Schema with Mongoose
 */
mongoose.model('Feedback', FeedbackSchema, 'feedback');
