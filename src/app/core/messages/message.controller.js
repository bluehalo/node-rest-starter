'use strict';

const { dbs, auditService } = require('../../../dependencies'),
	messageService = require('./messages.service').default,
	Message = dbs.admin.model('Message'),
	DismissedMessage = dbs.admin.model('DismissedMessage');

// Create
module.exports.create = async (req, res) => {
	const message = await messageService.create(req.user, req.body);

	// Publish message
	messageService.publishMessage(message);

	// Audit creation of messages
	await auditService.audit(
		'message created',
		'message',
		'create',
		req,
		Message.auditCopy(message)
	);

	res.status(200).json(message);
};

// Read
exports.read = (req, res) => {
	res.status(200).json(req.message);
};

// Update
module.exports.update = async (req, res) => {
	// Make a copy of the original message for auditing purposes
	const originalMessage = Message.auditCopy(req.message);

	const message = messageService.update(req.message, req.body);

	// Audit the save action
	await auditService.audit('message updated', 'message', 'update', req, {
		before: originalMessage,
		after: Message.auditCopy(message)
	});

	res.status(200).json(message);
};

// Delete
module.exports.delete = async (req, res) => {
	await messageService.delete(req.message);

	// Audit the message delete attempt
	await auditService.audit(
		'message deleted',
		'message',
		'delete',
		req,
		Message.auditCopy(req.message)
	);

	res.status(200).json(req.message);
};

// Search - with paging and sorting
module.exports.search = async (req, res) => {
	const results = await messageService.search(
		req.query,
		req.body.s,
		req.body.q
	);

	// Create the return copy of the messages
	results.elements = results.elements.map((element) =>
		Message.fullCopy(element)
	);

	res.status(200).json(results);
};

/**
 * Message middleware
 */
module.exports.messageById = async (req, res, next, id) => {
	const message = await messageService.read(id);
	if (!message) {
		return next(new Error(`Failed to load message: ${id}`));
	}
	req.message = message;
	return next();
};

/**
 * Gets recent messages from the past week that have not been dismissed
 */
module.exports.getRecentMessages = async (req, res) => {
	const result = await messageService.getRecentMessages(req.user._id);
	res.status(200).json(result);
};

/**
 * When a user dismisses a message, add it to the DismissedMessage collection
 * @param req
 * @param res
 */
exports.dismissMessage = async (req, res) => {
	const dismissedMessages = await messageService.dismissMessages(
		req.body['messageIds'],
		req.user
	);

	// Audit dismissal of messages
	for (const dismissedMessage of dismissedMessages) {
		auditService.audit(
			'message dismissed',
			'message',
			'dismissed',
			req,
			DismissedMessage.auditCopy(dismissedMessage)
		);
	}

	res.status(200).json(dismissedMessages);
};
