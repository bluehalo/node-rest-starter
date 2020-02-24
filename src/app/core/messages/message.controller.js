'use strict';

const
	mongoose = require('mongoose'),
	path = require('path'),
	ValidationError = mongoose.Error.ValidationError,
	q = require('q'),

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
exports.create = function(req, res) {
	const message = new Message(req.body);
	message.creator = req.user;
	message.created = Date.now();
	message.updated = Date.now();

	save(message, req.user, res, () => {
		// Audit creation of messages
		auditService.audit('message created', 'message', 'create', TeamMember.auditCopy(req.user, util.getHeaderField(req.headers, 'x-real-ip')), Message.auditCopy(message), req.headers);

		// Publish message
		sendMessage(message);
	});
};

// Read
exports.read = function(req, res) {
	res.status(200).json(req.message);
};

// Update
exports.update = function(req, res) {
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
		auditService.audit('message updated', 'message', 'update', TeamMember.auditCopy(req.user, util.getHeaderField(req.headers, 'x-real-ip')), { before: originalMessage, after: Message.auditCopy(message) }, req.headers);
	});
};

// Delete
exports.delete = function(req, res) {
	const message = req.message;
	Message.remove({_id: message._id}, (err) => {
		util.catchError(res, err, () => {
			res.status(200).json(message);
		});
	});

	// Audit the message delete attempt
	auditService.audit('message deleted', 'message', 'delete', TeamMember.auditCopy(req.user, util.getHeaderField(req.headers, 'x-real-ip')), Message.auditCopy(req.message), req.headers);

};


// Search - with paging and sorting
exports.search = function(req, res) {
	// Handle the query/search/page
	const query = req.body.q;
	const search = req.body.s;

	let page = req.query.page;
	let size = req.query.size;
	const sort = req.query.sort;
	let dir = req.query.dir;

	// Limit has to be at least 1 and no more than 100
	if(null == size){ size = 20; }
	size = Math.max(1, Math.min(100, size));

	// Page needs to be positive and has no upper bound
	if(null == page){ page = 0; }
	page = Math.max(0, page);

	// Sort can be null, but if it's non-null, dir defaults to DESC
	if(null != sort && dir == null){ dir = 'DESC'; }

	// Create the variables to the search call
	const limit = size;
	const offset = page*size;
	let sortArr;
	if(null != sort){
		sortArr = [{ property: sort, direction: dir }];
	}

	Message.search(query, search, limit, offset, sortArr).then((result) => {

		// Create the return copy of the messages
		const messages = [];
		result.results.forEach((element) => {
			messages.push(Message.fullCopy(element));
		});

		// success
		const toReturn = {
			totalSize: result.count,
			pageNumber: page,
			pageSize: size,
			totalPages: Math.ceil(result.count/size),
			elements: messages
		};

		// Serialize the response
		res.status(200).json(toReturn);
	}, (error) => {
		// failure
		logger.error(error);
		return util.send400Error(res, error);
	});
};

// Search - with paging and sorting
exports.searchTest = function(req, res) {
	let query = req.body.q || {};
	const search = req.body.s;

	if (search) {
		query = { '$and': [ query, { title_lowercase: new RegExp(search, 'i') } ] };
	}

	let page = req.query.page;
	let size = req.query.size;
	const sort = req.query.sort;
	let dir = req.query.dir;

	// Limit has to be at least 1 and no more than 100
	if (null == size){ size = 20; }
	size = Math.max(1, Math.min(100, size));

	// Page needs to be positive and has no upper bound
	if (null == page){ page = 0; }
	page = Math.max(0, page);

	// Sort can be null, but if it's non-null, dir defaults to DESC
	if (null != sort && dir == null){ dir = 'ASC'; }

	// Create the variables to the search call
	const limit = size;
	const offset = page*size;
	let sortParams;
	if (null != sort) {
		sortParams = {};
		sortParams[sort] = dir === 'ASC' ? 1 : -1;
	}

	const doSearch = function(query) {
		const getSearchCount = Message.find(query).count();
		const getSearchInfo = Message.find(query).sort(sortParams).skip(offset).limit(limit);

		return q.all([getSearchCount, getSearchInfo])
			.then((results) => {
				return q({
					totalSize: results[0],
					pageNumber: page,
					pageSize: size,
					totalPages: Math.ceil(results[0]/size),
					elements: results[1]
				});
			});
	};


	// If we aren't an admin, we need to constrain the results
	const searchPromise = doSearch(query);

	// Now execute the search promise
	searchPromise.then((results) => {
		res.status(200).json(results);
	}, (err) => {
		logger.error({err: err, req: req}, 'Error searching for messages');
		return util.handleErrorResponse(res, err);
	}).done();

};

/**
 * Message middleware
 */
exports.messageById = function(req, res, next, id) {
	Message.findOne({ _id: id })
		.exec((err, message) => {
			if (err) return next(err);
			if (!message) return next(new Error(`Failed to load message ${id}`));
			req.message = message;
			next();
		});
};

/**
 * Gets recent messages from the past week that have not been dismissed
 */
module.exports.getRecentMessages = function(req, res) {
	messageService.getRecentMessages(req.user._id).then((result) => {
		res.status(200).json(result);
	}, (err) => {
		util.handleErrorResponse(res, err);
	});
};

/**
 * When a user dismisses a message, add it to the DismissedMessage collection
 * @param req
 * @param res
 */
exports.dismissMessage = function(req, res) {
	messageService.dismissMessage(req.body.messageIds, req.user, req.headers).then((result) => {
		res.status(200).json(result);
	}, (err) => {
		util.handleErrorResponse(res, err);
	});
};

module.exports.sendMessage = sendMessage;
