'use strict';

const path = require('path'),
	{ dbs, config, utilService } = require('../../../dependencies'),
	publishProvider = require(path.posix.resolve(config.publishProvider));

/**
 * Import types for reference below
 *
 * @typedef {import('mongoose').PopulateOptions} PopulateOptions
 * @typedef {import('./types').MessageDocument} MessageDocument
 * @typedef {import('./types').LeanMessageDocument} LeanMessageDocument
 * @typedef {import('./types').DismissedMessageDocument} DismissedMessageDocument
 * @typedef {import('./types').LeanDismissedMessageDocument} LeanDismissedMessageDocument
 * @typedef {import('./types').DismissedMessageModel} DismissedMessageModel
 * @typedef {import('./types').MessageModel} MessageModel
 * @typedef {import('../user/types').UserDocument} UserDocument
 */

/**
 * @type {MessageModel}
 */
const Message = dbs.admin.model('Message');

/**
 * @type {DismissedMessageModel}
 */
const DismissedMessage = dbs.admin.model('DismissedMessage');

const copyMutableFields = (dest, src) => {
	['title', 'type', 'body', 'ackRequired'].forEach((key) => {
		if (null != src[key]) {
			dest[key] = src[key];
		}
	});
};

class MessagesService {
	/**
	 * @param {UserDocument} user
	 * @param {*} doc
	 * @returns {Promise<MessageDocument>}
	 */
	create(user, doc) {
		const message = new Message(doc);
		message.creator = user._id;
		message.created = Date.now();
		message.updated = Date.now();

		return message.save();
	}

	/**
	 * @param {string} id
	 * @param {string | PopulateOptions | Array<string | PopulateOptions>} [populate]
	 * @returns {Promise<MessageDocument | null>}
	 */
	read(id, populate = []) {
		return Message.findById(id)
			.populate(/** @type {string} */ (populate))
			.exec();
	}

	/**
	 * @param {MessageDocument} document The document to update
	 * @param {*} obj The object with updated fields
	 * @returns {Promise<MessageDocument>}
	 */
	update(document, obj) {
		copyMutableFields(document, obj);
		document.updated = Date.now();
		return document.save();
	}

	/**
	 * @param {MessageDocument} document The document to delete
	 * @returns {Promise<MessageDocument>}
	 */
	delete(document) {
		return document.remove();
	}

	/**
	 * @param [queryParams]
	 * @param {string} [search]
	 * @param {import('mongoose').FilterQuery<MessageDocument>} [query]
	 * @returns {Promise<import('../../common/mongoose/types').PagingResults<MessageDocument>>}
	 */
	search(queryParams = {}, search = '', query = {}) {
		query = query || {};
		const page = utilService.getPage(queryParams);
		const limit = utilService.getLimit(queryParams);
		const sort = utilService.getSortObj(queryParams, 'DESC', 'updated');

		return Message.find(query)
			.textSearch(search)
			.sort(sort)
			.paginate(limit, page);
	}

	/**
	 * @returns {Promise<Array<LeanMessageDocument>>}
	 */
	getAllMessages() {
		const timeLimit = config['dismissedMessagesTimePeriod'] ?? 604800000;

		return Message.find()
			.where('created')
			.gte(Date.now() - timeLimit)
			.lean()
			.exec();
	}

	/**
	 * @param userId
	 * @returns {Promise<Array<LeanDismissedMessageDocument>>}
	 */
	getDismissedMessages(userId) {
		return DismissedMessage.find({ userId: userId }).lean().exec();
	}

	/**
	 * Get recent, unread messages
	 *
	 * @param userId
	 * @returns {Promise<Array<LeanMessageDocument>>}
	 */
	async getRecentMessages(userId) {
		const [allMessages, dismissedMessages] = await Promise.all([
			this.getAllMessages(),
			this.getDismissedMessages(userId)
		]);

		const filteredMessages = allMessages.filter((message) => {
			const isDismissed = dismissedMessages.some((dismissed) =>
				dismissed.messageId.equals(message._id)
			);
			return !isDismissed;
		});

		return filteredMessages;
	}

	/**
	 *
	 * @param {string[]} messageIds
	 * @param {UserDocument} user
	 * @returns {Promise<DismissedMessageDocument[]>}
	 */
	dismissMessages(messageIds, user) {
		const dismissals = messageIds.map((messageId) =>
			new DismissedMessage({ messageId, userId: user._id }).save()
		);
		return Promise.all(dismissals);
	}

	/**
	 * Publish a message
	 *
	 * @param {MessageDocument} message The message to be published
	 */
	publishMessage(message) {
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
	}
}

module.exports = new MessagesService();
