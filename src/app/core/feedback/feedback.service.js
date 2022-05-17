'use strict';

const deps = require('../../../dependencies'),
	dbs = deps.dbs,
	config = deps.config,
	emailService = deps.emailService,
	util = deps.utilService,
	logger = deps.logger,
	Feedback = dbs.admin.model('Feedback'),
	mongoose = require('mongoose');

const sendFeedback = async (user, feedback, req) => {
	try {
		const mailOptions = await emailService.generateMailOptions(
			user,
			req,
			config.coreEmails.feedbackEmail,
			{
				url: feedback.url,
				feedback: feedback.body,
				feedbackType: feedback.type
			}
		);
		await emailService.sendMail(mailOptions);
		logger.debug(`Sent approved user (${user.username}) alert email`);
	} catch (error) {
		// Log the error but this shouldn't block
		logger.error({ err: error, req: req }, 'Failure sending email.');
	}
};

const create = async (reqUser, newFeedback, userSpec) => {
	const feedback = new Feedback({
		body: newFeedback.body,
		type: newFeedback.type,
		url: newFeedback.url,
		classification: newFeedback.classification,
		creator: reqUser._id,
		browser: userSpec.browser,
		os: userSpec.os
	});

	try {
		return await feedback.save();
	} catch (err) {
		// Log and continue the error
		logger.error(
			{ err: err, feedback: newFeedback },
			'Error trying to persist feedback record to storage.'
		);
		return Promise.reject(err);
	}
};

const search = (reqUser, queryParams, search, query) => {
	query = query || {};
	const page = util.getPage(queryParams);
	const limit = util.getLimit(queryParams, 100);
	const sort = util.getSortObj(queryParams);

	// Query for feedback
	return Feedback.find(query)
		.textSearch(search)
		.sort(sort)
		.populate({
			path: 'creator',
			select: ['username', 'organization', 'name', 'email']
		})
		.paginate(limit, page);
};

const readFeedback = (feedbackId, populate = []) => {
	if (!mongoose.Types.ObjectId.isValid(feedbackId)) {
		throw { status: 400, type: 'validation', message: 'Invalid feedback ID' };
	}
	return Feedback.findById(feedbackId).populate(populate).exec();
};

const updateFeedbackAssignee = (feedback, assignee) => {
	feedback.assignee = assignee;
	feedback.updated = Date.now();
	return feedback.save();
};

const updateFeedbackStatus = (feedback, status) => {
	feedback.status = status;
	feedback.updated = Date.now();
	return feedback.save();
};

module.exports = {
	create,
	search,
	sendFeedback,
	readFeedback,
	updateFeedbackAssignee,
	updateFeedbackStatus
};
