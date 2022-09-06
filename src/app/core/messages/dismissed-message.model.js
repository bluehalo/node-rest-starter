'use strict';

const mongoose = require('mongoose'),
	getterPlugin = require('../../common/mongoose/getter.plugin'),
	deps = require('../../../dependencies'),
	config = deps.config,
	util = deps.utilService;

/**
 * Import types for reference below
 * @typedef {import('./types').DismissedMessageDocument} DismissedMessageDocument
 * @typedef {import('./types').DismissedMessageModel} DismissedMessageModel
 */

/**
 * @type {mongoose.Schema<DismissedMessageDocument, DismissedMessageModel>}
 */
const DismissedMessageSchema = new mongoose.Schema({
	messageId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Message'
	},
	userId: {
		type: mongoose.Schema.Types.ObjectId,
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

const expireAfterSeconds = config?.messages?.expireSeconds ?? 2592000; // default to 30 days

/* @ts-ignore: Error due to mongo/mongoose type mismatch, need to upgrade mongoose to correct */
DismissedMessageSchema.index({ created: -1 }, { expireAfterSeconds });
DismissedMessageSchema.index({ userId: 1 });

/**
 * Lifecycle Hooks
 */

/**
 * Instance Methods
 */

/**
 * Static Methods
 */
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
const DismissedMessage = mongoose.model(
	'DismissedMessage',
	DismissedMessageSchema,
	'messages.dismissed'
);

module.exports = DismissedMessage;
