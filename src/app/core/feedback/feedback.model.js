'use strict';

const mongoose = require('mongoose'),
	getterPlugin = require('../../common/mongoose/getter.plugin'),
	paginatePlugin = require('../../common/mongoose/paginate.plugin'),
	textSearchPlugin = require('../../common/mongoose/text-search.plugin'),
	deps = require('../../../dependencies'),
	util = deps.utilService;

const Statuses = Object.freeze({
	new: 'New',
	open: 'Open',
	closed: 'Closed'
});

/**
 * Import types for reference below
 * @typedef {import('./types').FeedbackDocument} FeedbackDocument
 * @typedef {import('./types').FeedbackModel} FeedbackModel
 */

/**
 * @type {mongoose.Schema<FeedbackDocument, FeedbackModel>}
 */
const FeedbackSchema = new mongoose.Schema({
	created: {
		type: Date,
		default: () => Date.now(),
		get: util.dateParse
	},
	creator: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	},
	body: { type: String },
	type: { type: String },
	url: { type: String },
	os: { type: String },
	browser: { type: String },
	classification: { type: String },
	status: {
		type: String,
		default: Statuses.new,
		enum: Object.values(Statuses),
		required: true
	},
	assignee: { type: String },
	updated: {
		type: Date,
		default: () => Date.now(),
		get: util.dateParse,
		required: true
	}
});

FeedbackSchema.plugin(getterPlugin);
FeedbackSchema.plugin(paginatePlugin);
FeedbackSchema.plugin(textSearchPlugin);

/**
 * Index declarations
 */

// Created datetime index, expires after 180 days

FeedbackSchema.index({ created: -1 }, { expireAfterSeconds: 15552000 });
FeedbackSchema.index({ type: 1 });
FeedbackSchema.index({ creator: 1 });
FeedbackSchema.index({ url: 1 });
FeedbackSchema.index({ os: 1 });
FeedbackSchema.index({ browser: 1 });
FeedbackSchema.index({ status: 1 });
FeedbackSchema.index({ assignee: 1 });

// Text-search index
FeedbackSchema.index({ body: 'text' });

/*****************
 * Lifecycle hooks
 *****************/

/*****************
 * Static Methods
 *****************/

Object.assign(FeedbackSchema.statics, {
	Statuses
});

/**
 * Register the Schema with Mongoose
 */
const Feedback = mongoose.model('Feedback', FeedbackSchema, 'feedback');

module.exports = Feedback;
