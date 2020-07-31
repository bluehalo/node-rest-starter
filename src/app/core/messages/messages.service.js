'use strict';

const deps = require('../../../dependencies'),
	dbs = deps.dbs,
	config = deps.config,
	auditService = deps.auditService,

	Message = dbs.admin.model('Message'),
	DismissedMessage = dbs.admin.model('DismissedMessage'),
	TeamMember = dbs.admin.model('TeamUser');


module.exports = function() {

	function getAllMessages() {
		const timeLimit = config.dismissedMessagesTimePeriod || 604800000;

		return Message.find({created: {'$gte': new Date(Date.now() - timeLimit)}}).lean();
	}

	function getDismissedMessages(userId) {
		return DismissedMessage.find({userId: userId}).lean();
	}

	// Get recent, unread messages
	function getRecentMessages(userId) {

		return Promise.all([getAllMessages(), getDismissedMessages(userId)]).then(([messages, dismissedMessages]) => {
			messages = messages.filter((message) => !dismissedMessages.some((x) => {
				if (x.messageId.toString() === message._id.toString()) {
					return message;
				}
			}));
			return messages;
		});
	}

	function dismissMessage(messageIds, user, headers) {
		const dismissedMessagePromises = [];
		const saveDismissedMessagePromise = (dismissedMessage) => {
			const dismissedMessagePromise = dismissedMessage.save();
			dismissedMessagePromises.push(dismissedMessagePromise);
		};

		for (let i = 0; i < messageIds.length; i++) {
			const dismissedMessage = new DismissedMessage();
			dismissedMessage.messageId = messageIds[i];
			dismissedMessage.userId = user._id;

			// Audit creation of messages
			auditService.audit('message dismissed', 'message', 'dismissed', TeamMember.auditCopy(user), Message.auditCopy(dismissedMessage), headers)
				.then(saveDismissedMessagePromise);
		}
		return Promise.all(dismissedMessagePromises);

	}

	return {
		getRecentMessages: getRecentMessages,
		dismissMessage: dismissMessage
	};
};
