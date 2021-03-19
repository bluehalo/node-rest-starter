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
	if (
		null == user ||
		null == feedback.body ||
		null == feedback.type ||
		null == feedback.url
	) {
		return Promise.reject({ status: 400, message: 'Invalid submission.' });
	}

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

const search = async (reqUser, queryParams, query) => {
	query = query || {};
	const page = util.getPage(queryParams);
	const limit = util.getLimit(queryParams, 100);
	const sortArr = util.getSort(queryParams);
	const offset = page * limit;

	// Query for feedback
	const feedback = await Feedback.textSearch(
		query,
		null,
		limit,
		offset,
		sortArr,
		true,
		{
			path: 'creator',
			select: ['username', 'organization', 'name', 'email']
		}
	);

	return util.getPagingResults(limit, page, feedback.count, feedback.results);
};

const getFeedbackById = async (feedbackId) => {
	return await Feedback.findOne({
		_id: mongoose.Types.ObjectId(feedbackId)
	}).populate({
		path: 'creator',
		select: ['username', 'organization', 'name', 'email']
	});
};

const updateFeedbackAssignee = async (feedbackId, assignee) => {
	const feedback = await getFeedbackById(feedbackId);
	feedback.assignee = assignee;
	feedback.updated = Date.now();
	await feedback.save();
	return feedback;
};

const updateFeedbackStatus = async (feedbackId, status) => {
	const feedback = await getFeedbackById(feedbackId);
	feedback.status = status;
	feedback.updated = Date.now();
	await feedback.save();
	return feedback;
};

module.exports = {
	create,
	search,
	sendFeedback,
	updateFeedbackAssignee,
	updateFeedbackStatus
};
