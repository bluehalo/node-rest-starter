import { StatusCodes } from 'http-status-codes';

import messageService from './messages.service';
import { auditService } from '../../../dependencies';
import { NotFoundError } from '../../common/errors';

// Create
export const create = async (req, res) => {
	const message = await messageService.create(req.user, req.body);

	// Publish message
	messageService.publishMessage(message);

	// Audit creation of messages
	await auditService.audit(
		'message created',
		'message',
		'create',
		req,
		message.auditCopy()
	);

	res.status(StatusCodes.OK).json(message);
};

// Read
export const read = (req, res) => {
	res.status(StatusCodes.OK).json(req.message);
};

// Update
export const update = async (req, res) => {
	// Make a copy of the original message for auditing purposes
	const originalMessage = req.message.auditCopy();

	const updatedMessage = await messageService.update(req.message, req.body);

	// Audit the save action
	await auditService.audit('message updated', 'message', 'update', req, {
		before: originalMessage,
		after: updatedMessage.auditCopy()
	});

	res.status(StatusCodes.OK).json(updatedMessage);
};

// Delete
export const deleteMessage = async (req, res) => {
	await messageService.delete(req.message);

	// Audit the message delete attempt
	await auditService.audit(
		'message deleted',
		'message',
		'delete',
		req,
		req.message.auditCopy()
	);

	res.status(StatusCodes.OK).json(req.message);
};

// Search - with paging and sorting
export const search = async (req, res) => {
	const results = await messageService.search(
		req.query,
		req.body.s,
		req.body.q
	);

	// Create the return copy of the messages
	const mappedResults = {
		pageNumber: results.pageNumber,
		pageSize: results.pageSize,
		totalPages: results.totalPages,
		totalSize: results.totalSize,
		elements: results.elements.map((element) => element.fullCopy())
	};

	res.status(StatusCodes.OK).json(mappedResults);
};

/**
 * Message middleware
 */
export const messageById = async (req, res, next, id) => {
	const message = await messageService.read(id);
	if (!message) {
		return next(new NotFoundError(`Failed to load message: ${id}`));
	}
	req.message = message;
	return next();
};

/**
 * Gets recent messages from the past week that have not been dismissed
 */
export const getRecentMessages = async (req, res) => {
	const result = await messageService.getRecentMessages(req.user._id);
	res.status(StatusCodes.OK).json(result);
};

/**
 * When a user dismisses a message, add it to the DismissedMessage collection
 * @param req
 * @param res
 */
export const dismissMessage = async (req, res) => {
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
			dismissedMessage.auditCopy()
		);
	}

	res.status(StatusCodes.OK).json(dismissedMessages);
};
