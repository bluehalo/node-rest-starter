'use strict';

const mongoose = require('mongoose'),
	getterPlugin = require('../../common/mongoose/getter.plugin'),
	paginatePlugin = require('../../common/mongoose/paginate.plugin'),
	textSearchPlugin = require('../../common/mongoose/text-search.plugin'),
	deps = require('../../../dependencies'),
	util = deps.utilService;

/**
 * Import types for reference below
 * @typedef {import('./types').MessageDocument} MessageDocument
 * @typedef {import('./types').MessageModel} MessageModel
 * @typedef {import('./types').DismissedMessageDocument} DismissedMessageDocument
 * @typedef {import('./types').DismissedMessageModel} DismissedMessageModel
 */

/**
 * @type {mongoose.Schema<MessageDocument, MessageModel>}
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
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	}
});
MessageSchema.plugin(getterPlugin);
MessageSchema.plugin(paginatePlugin);
MessageSchema.plugin(textSearchPlugin);

/**
 * Index declarations
 */

// MessageSchema.index({created: -1});

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

/**
 * Model Registration
 */
const Message = mongoose.model('Message', MessageSchema, 'messages');

module.exports = Message;
