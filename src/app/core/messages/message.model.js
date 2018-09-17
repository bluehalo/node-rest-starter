'use strict';

const
	_ = require('lodash'),
	mongoose = require('mongoose'),

	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	config = deps.config,
	util = deps.utilService,
	query = deps.queryService,

	GetterSchema = deps.schemaService.GetterSchema;

/**
 * Message Schema
 */

let MessageSchema = new GetterSchema({
	title: {
		type: String,
		trim: true,
		required: 'Title is required'
	},
	tearline: {
		type: String,
		trim: true
	},
	type: {
		type: String,
		enum: ['INFO', 'WARN', 'ERROR'],
		default: null
	},
	body: {
		type: String,
		trim: true,
		required: 'Message is required'
	},
	ackRequired: {
		type: Boolean,
		default: false
	},
	updated: {
		type: Date,
		get: util.dateParse
	},
	created: {
		type: Date,
		default: Date.now,
		get: util.dateParse
	},
	creator: {
		type: mongoose.Schema.ObjectId,
		ref: 'User'
	}
});

let DismissedMessageSchema = new GetterSchema({
	messageId: {
		type: mongoose.Schema.ObjectId,
		ref: 'Message'
	},
	userId: {
		type: mongoose.Schema.ObjectId,
		ref: 'User'
	},
	created: {
		type: Date,
		default: Date.now,
		get: util.dateParse
	}
});

/**
 * Index declarations
 */

// MessageSchema.index({created: -1});
let expireAfterSeconds = _.get(config, 'messages.expireSeconds', 2592000); // default to 30 days
DismissedMessageSchema.index({ created: -1 }, { expireAfterSeconds: expireAfterSeconds });
DismissedMessageSchema.index({ userId: 1});

// Text-search index
MessageSchema.index({ title: 'text', tearline: 'text', type: 'text' });

/**
 * Lifecycle Hooks
 */

/**
 * Instance Methods
 */

/**
 * Static Methods
 */
MessageSchema.statics.auditCopy = function(src) {
	let newMessage = {};
	src = src || {};

	newMessage.type = src.type;
	newMessage.title = src.title;
	newMessage.tearline = src.tearline;
	newMessage.body = src.body;
	newMessage.ackRequired = src.ackRequired;
	newMessage.created = src.created;
	newMessage.updated  = src.updated;
	newMessage._id = src._id;

	return newMessage;
};

MessageSchema.statics.fullCopy = function(src) {
	let newMessage = {};
	src = src || {};

	newMessage.type = src.type;
	newMessage.title = src.title;
	newMessage.tearline = src.tearline;
	newMessage.body = src.body;
	newMessage.ackRequired = src.ackRequired;
	newMessage.created = src.created;
	newMessage.updated  = src.updated;
	newMessage._id = src._id;

	return newMessage;
};

MessageSchema.statics.search = function(queryTerms, searchTerms, limit, offset, sortArr) {
	return query.search(this, queryTerms, searchTerms, limit, offset, sortArr);
};

DismissedMessageSchema.statics.auditCopy = function(src) {
	let dismissedMessage = {};
	src = src || {};

	dismissedMessage.messageId = src.messageId;
	dismissedMessage.userId = src.userId;
	dismissedMessage.created = src.created;
	dismissedMessage._id = src._id;

	return dismissedMessage;
};

/**
 * Model Registration
 */
dbs.admin.model('Message', MessageSchema, 'messages');
dbs.admin.model('DismissedMessage', DismissedMessageSchema, 'messages.dismissed');
