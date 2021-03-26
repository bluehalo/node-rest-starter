'use strict';

const mongoose = require('mongoose'),
	path = require('path'),
	ValidationError = mongoose.Error.ValidationError,
	deps = require('../../../dependencies'),
	config = deps.config,
	dbs = deps.dbs,
	logger = deps.logger,
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

// Given a message save to mongo and send update to storm
function save(message, user, res, audit) {
	const error = new ValidationError(message);

	if (!error.errors || Object.keys(error.errors).length === 0) {
		message.save((err, result) => {
			util.catchError(res, err, () => {
				res.status(200).json(result);
				audit();
			});
		});
	} else {
		util.send400Error(res, error.group);
	}
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
exports.create = function (req, res) {
	const message = new Message(req.body);
	message.creator = req.user;
	message.created = Date.now();
	message.updated = Date.now();

	save(message, req.user, res, () => {
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
	});
};

// Read
exports.read = function (req, res) {
	res.status(200).json(req.message);
};

// Update
exports.update = function (req, res) {
	// Retrieve the message from persistence
	const message = req.message;

	// Make a copy of the original deck for a "before" snapshot
	const originalMessage = Message.auditCopy(message);

	// Update the updated date
	message.updated = Date.now();

	copyMutableFields(message, req.body);

	// Save
	save(message, req.user, res, () => {
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
	});
};

// Delete
exports.delete = function (req, res) {
	const message = req.message;
	Message.deleteOne({ _id: message._id })
		.exec()
		.catch((err) => {
			util.catchError(res, err, () => {
				res.status(200).json(message);
			});
		});

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
};

// Search - with paging and sorting
exports.search = function (req, res) {
	// Handle the query/search/page
	const query = req.body.q;
	const search = req.body.s;

	const page = util.getPage(req.query);
	const limit = util.getLimit(req.query);
	const sortArr = util.getSort(req.query, 'DESC');
	const offset = page * limit;

	Message.textSearch(query, search, limit, offset, sortArr)
		.then((result) => {
			// Create the return copy of the messages
			const messages = [];
			result.results.forEach((element) => {
				messages.push(Message.fullCopy(element));
			});

			// success
			const toReturn = util.getPagingResults(
				limit,
				page,
				result.count,
				messages
			);

			// Serialize the response
			res.status(200).json(toReturn);
		})
		.catch((error) => {
			// failure
			logger.error(error);
			return util.send400Error(res, error);
		});
};

// Search - with paging and sorting
exports.searchTest = function (req, res) {
	let query = req.body.q || {};
	const search = req.body.s;

	if (search) {
		query = { $and: [query, { title_lowercase: new RegExp(search, 'i') }] };
	}

	const page = util.getPage(req.query);
	const limit = util.getLimit(req.query);
	const sort = req.query.sort;
	let dir = req.query.dir;

	// Sort can be null, but if it's non-null, dir defaults to DESC
	if (null != sort && dir == null) {
		dir = 'ASC';
	}

	// Create the variables to the search call
	const offset = page * limit;
	let sortParams;
	if (null != sort) {
		sortParams = {};
		sortParams[sort] = dir === 'ASC' ? 1 : -1;
	}

	const doSearch = function (_query) {
		const getSearchCount = Message.find(_query).countDocuments();
		const getSearchInfo = Message.find(_query)
			.sort(sortParams)
			.skip(offset)
			.limit(limit);

		return Promise.all([getSearchCount.exec(), getSearchInfo.exec()]).then(
			(results) => {
				return util.getPagingResults(limit, page, results[0], results[1]);
			}
		);
	};

	// If we aren't an admin, we need to constrain the results
	const searchPromise = doSearch(query);

	// Now execute the search promise
	searchPromise
		.then((results) => {
			res.status(200).json(results);
		})
		.catch((err) => {
			logger.error({ err: err, req: req }, 'Error searching for messages');
			return util.handleErrorResponse(res, err);
		});
};

/**
 * Message middleware
 */
exports.messageById = function (req, res, next, id) {
	Message.findOne({ _id: id }).exec((err, message) => {
		if (err) return next(err);
		if (!message) return next(new Error(`Failed to load message ${id}`));
		req.message = message;
		next();
	});
};

/**
 * Gets recent messages from the past week that have not been dismissed
 */
module.exports.getRecentMessages = function (req, res) {
	messageService
		.getRecentMessages(req.user._id)
		.then((result) => {
			res.status(200).json(result);
		})
		.catch((err) => {
			util.handleErrorResponse(res, err);
		});
};

/**
 * When a user dismisses a message, add it to the DismissedMessage collection
 * @param req
 * @param res
 */
exports.dismissMessage = function (req, res) {
	messageService
		.dismissMessage(req.body.messageIds, req.user, req.headers)
		.then((result) => {
			res.status(200).json(result);
		})
		.catch((err) => {
			util.handleErrorResponse(res, err);
		});
};

module.exports.sendMessage = sendMessage;
