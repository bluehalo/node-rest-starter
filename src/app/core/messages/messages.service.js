'use strict';

const path = require('path'),
	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	config = deps.config,
	util = deps.utilService,
	publishProvider = require(path.posix.resolve(config.publishProvider));

/**
 * @type {import('./types').MessageModel}
 */
const Message = dbs.admin.model('Message');

/**
 * @typedef {import('./types').DismissedMessageModel} DismissedMessageModel
 */
const DismissedMessage = dbs.admin.model('DismissedMessage');

const copyMutableFields = (dest, src) => {
	['title', 'type', 'body', 'ackRequired'].forEach((key) => {
		if (null != src[key]) {
			dest[key] = src[key];
		}
	});
};

/**
 * Import types for reference below
 * @typedef {import('./types').MessageDocument} MessageDocument
 * @typedef {import('mongoose').LeanDocument<MessageDocument>} LeanMessageDocument
 * @typedef {import('./types').DismissedMessageDocument} DismissedMessageDocument
 * @typedef {import('mongoose').LeanDocument<DismissedMessage>} LeanDismissedMessageDocument
 * @typedef {import('mongoose').PopulateOptions} PopulateOptions
 * @typedef {import('../user/types').UserDocument} UserDocument
 */

/**
 * @param {UserDocument} user
 * @param {*} doc
 * @returns {Promise<MessageDocument>}
 */
const create = (user, doc) => {
	const message = new Message(doc);
	message.creator = user._id;
	message.created = Date.now();
	message.updated = Date.now();

	return message.save();
};

/**
 * @param {string} id
 * @param {string | PopulateOptions | Array<string | PopulateOptions>} [populate]
 * @returns {Promise<MessageDocument | null>}
 */
const read = (id, populate = []) => {
	return Message.findById(id).populate(populate).exec();
};

/**
 * @param {MessageDocument} record The record to edit
 * @param {*} updatedRecord The record with updated fields
 * @returns {Promise<MessageDocument>}
 */
const update = (record, updatedRecord) => {
	copyMutableFields(record, updatedRecord);
	record.updated = Date.now();
	return record.save();
};

/**
 * @param {MessageDocument} record The record to edit
 * @returns {Promise<MessageDocument>}
 */
const deleteMessage = (record) => {
	return record.remove();
};

/**
 * @param [queryParams]
 * @param {string} [search]
 * @param {import('mongoose').FilterQuery<MessageDocument>} [query]
 * @returns {Promise<import('../../common/mongoose/types').PagingResults<MessageDocument>>}
 */
const search = (queryParams = {}, search = '', query = {}) => {
	query = query || {};
	const page = util.getPage(queryParams);
	const limit = util.getLimit(queryParams);
	const sort = util.getSortObj(queryParams, 'DESC', 'updated');

	return Message.find(query)
		.textSearch(search)
		.sort(sort)
		.paginate(limit, page);
};

/**
 * @returns {Promise<Array<LeanMessageDocument>>}
 */
const getAllMessages = () => {
	const timeLimit = config.dismissedMessagesTimePeriod || 604800000;

	return Message.find()
		.where('created')
		.gte(Date.now() - timeLimit)
		.lean()
		.exec();
};

/**
 * @param userId
 * @returns {Promise<Array<LeanDismissedMessageDocument>>}
 */
const getDismissedMessages = (userId) => {
	return DismissedMessage.find({ userId: userId }).lean().exec();
};

/**
 * Get recent, unread messages
 *
 * @param userId
 * @returns {Promise<Array<LeanMessageDocument>>}
 */
const getRecentMessages = async (userId) => {
	const [allMessages, dismissedMessages] = await Promise.all([
		getAllMessages(),
		getDismissedMessages(userId)
	]);

	const filteredMessages = allMessages.filter((message) => {
		const isDismissed = dismissedMessages.some((dismissed) =>
			dismissed.messageId.equals(message._id)
		);
		return !isDismissed;
	});

	return filteredMessages;
};

/**
 *
 * @param {string[]} messageIds
 * @param {UserDocument} user
 * @returns {Promise<DismissedMessage[]>}
 */
const dismissMessages = (messageIds, user) => {
	const dismissals = messageIds.map((messageId) =>
		new DismissedMessage({ messageId, userId: user._id }).save()
	);
	return Promise.all(dismissals);
};

/**
 * Publish a message
 *
 * @param {MessageDocument} message The message to be published
 */
const publishMessage = (message) => {
	publishProvider.publish(
		config.messages.topic,
		{
			type: 'message',
			id: message._id.toString(),
			time: Date.now(),
			message: message.toObject()
		},
		true
	);
};

module.exports = {
	create,
	read,
	update,
	delete: deleteMessage,
	search: search,
	getRecentMessages,
	dismissMessages,
	publishMessage
};
