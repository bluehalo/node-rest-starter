'use strict';

const _ = require('lodash'),
	mongoose = require('mongoose'),
	getterPlugin = require('../../common/mongoose/getter.plugin'),
	pagingSearchPlugin = require('../../common/mongoose/paging-search.plugin'),
	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	config = deps.config,
	util = deps.utilService;

/**
 * Message Schema
 */

const MessageSchema = new mongoose.Schema({
	title: {
		type: String,
		trim: true,
		required: 'Title is required'
	},
	type: {
		type: String,
		enum: ['INFO', 'WARN', 'ERROR', 'MOTD'],
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
MessageSchema.plugin(getterPlugin);
MessageSchema.plugin(pagingSearchPlugin);

const DismissedMessageSchema = new mongoose.Schema({
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
DismissedMessageSchema.plugin(getterPlugin);

/**
 * Index declarations
 */

// MessageSchema.index({created: -1});
const expireAfterSeconds = _.get(config, 'messages.expireSeconds', 2592000); // default to 30 days
DismissedMessageSchema.index(
	{ created: -1 },
	{ expireAfterSeconds: expireAfterSeconds }
);
DismissedMessageSchema.index({ userId: 1 });

// Text-search index
MessageSchema.index({ title: 'text', body: 'text', type: 'text' });

/**
 * Lifecycle Hooks
 */

/**
 * Instance Methods
 */

/**
 * Static Methods
 */
MessageSchema.statics.auditCopy = function (src) {
	const newMessage = {};
	src = src || {};

	newMessage.type = src.type;
	newMessage.title = src.title;
	newMessage.body = src.body;
	newMessage.ackRequired = src.ackRequired;
	newMessage.created = src.created;
	newMessage.updated = src.updated;
	newMessage._id = src._id;

	return newMessage;
};

MessageSchema.statics.fullCopy = function (src) {
	const newMessage = {};
	src = src || {};

	newMessage.type = src.type;
	newMessage.title = src.title;
	newMessage.body = src.body;
	newMessage.ackRequired = src.ackRequired;
	newMessage.created = src.created;
	newMessage.updated = src.updated;
	newMessage._id = src._id;

	return newMessage;
};

DismissedMessageSchema.statics.auditCopy = function (src) {
	const dismissedMessage = {};
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
dbs.admin.model(
	'DismissedMessage',
	DismissedMessageSchema,
	'messages.dismissed'
);
