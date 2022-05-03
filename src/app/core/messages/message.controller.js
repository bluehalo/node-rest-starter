'use strict';

const path = require('path'),
	deps = require('../../../dependencies'),
	config = deps.config,
	dbs = deps.dbs,
	auditService = deps.auditService,
	util = deps.utilService,
	messageService = require('./messages.service')(),
	publishProvider = require(path.posix.resolve(config.publishProvider)),
	TeamMember = dbs.admin.model('TeamUser'),
	Message = dbs.admin.model('Message');

function copyMutableFields(dest, src) {
	['title', 'type', 'body', 'ackRequired'].forEach((key) => {
		if (null != src[key]) {
			dest[key] = src[key];
		}
	});
}

/**
 * Publish
 */
function publish(destination, message, retry) {
	return publishProvider.publish(destination, message, retry);
}

/**
 * Publish a message
 *
 * @param {Message} message The message to be published
 * @returns {Promise} A promise that is resolved when the send is successful.
 */
function sendMessage(message) {
	// Turn Mongo models into regular objects before we serialize
	if (null != message && null != message.toObject) {
		message = message.toObject();
	} else {
		throw new Error("'message' parameter must be defined'");
	}

	const payload = {
		type: 'message',
		id: message._id.toString(),
		time: Date.now(),
		message: message
	};
	const destination = config.messages.topic;
	return publish(destination, payload, true);
}

// Create
module.exports.create = async (req, res) => {
	const message = new Message(req.body);
	message.creator = req.user;
	message.created = Date.now();
	message.updated = Date.now();

	await message.save();

	// Audit creation of messages
	auditService.audit(
		'message created',
		'message',
		'create',
		TeamMember.auditCopy(
			req.user,
			util.getHeaderField(req.headers, 'x-real-ip')
		),
		Message.auditCopy(message),
		req.headers
	);

	// Publish message
	sendMessage(message);

	res.status(200).json(message);
};

// Read
exports.read = (req, res) => {
	res.status(200).json(req.message);
};

// Update
module.exports.update = async (req, res) => {
	// Retrieve the message from persistence
	const message = req.message;

	// Make a copy of the original deck for a "before" snapshot
	const originalMessage = Message.auditCopy(message);

	// Update the updated date
	message.updated = Date.now();

	copyMutableFields(message, req.body);

	// Save
	await message.save();

	// Audit the save action
	auditService.audit(
		'message updated',
		'message',
		'update',
		TeamMember.auditCopy(
			req.user,
			util.getHeaderField(req.headers, 'x-real-ip')
		),
		{ before: originalMessage, after: Message.auditCopy(message) },
		req.headers
	);

	res.status(200).json(message);
};

// Delete
module.exports.delete = async (req, res) => {
	const message = req.message;
	await Message.deleteOne({ _id: message._id }).exec();

	// Audit the message delete attempt
	auditService.audit(
		'message deleted',
		'message',
		'delete',
		TeamMember.auditCopy(
			req.user,
			util.getHeaderField(req.headers, 'x-real-ip')
		),
		Message.auditCopy(req.message),
		req.headers
	);

	res.status(200).json(message);
};

// Search - with paging and sorting
module.exports.search = async (req, res) => {
	const page = util.getPage(req.query);
	const limit = util.getLimit(req.query);
	const sort = util.getSortObj(req.query, 'DESC');

	const result = await Message.find(req.body.q)
		.textSearch(req.body.s)
		.sort(sort)
		.paginate(limit, page);

	// Create the return copy of the messages
	result.elements = result.elements.map((element) => Message.fullCopy(element));

	res.status(200).json(result);
};

/**
 * Message middleware
 */
module.exports.messageById = async (req, res, next, id) => {
	const message = await Message.findById(id);
	if (!message) {
		return next(new Error(`Failed to load message ${id}`));
	}
	req.message = message;
	next();
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
module.exports.dismissMessage = async (req, res) => {
	const result = await messageService.dismissMessage(
		req.body.messageIds,
		req.user,
		req.headers
	);
	res.status(200).json(result);
};

module.exports.sendMessage = sendMessage;
