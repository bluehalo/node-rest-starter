'use strict';

const
	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	config = deps.config,
	emailService = deps.emailService,
	utilService = deps.utilService,
	logger = deps.logger,
	Feedback = dbs.admin.model('Feedback');

const sendFeedback = async (user, feedback, req) => {
	if (null == user || null == feedback.body || null == feedback.type || null == feedback.url) {
		return Promise.reject({ status: 400, message: 'Invalid submission.' });
	}

	try {
		const mailOptions = await emailService.generateMailOptions(user, req, config.coreEmails.feedbackEmail, {
			url: feedback.url,
			feedback: feedback.body,
			feedbackType: feedback.type
		});
		await emailService.sendMail(mailOptions);
		logger.debug(`Sent approved user (${user.username}) alert email`);
	} catch (error) {
		// Log the error but this shouldn't block
		logger.error({err: error, req: req}, 'Failure sending email.');
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
		logger.error({err: err, feedback: newFeedback}, 'Error trying to persist feedback record to storage.');
		return Promise.reject(err);
	}
};

const search = async (reqUser, queryParams, query) => {
	query = query || {};
	const page = utilService.getPage(queryParams);
	const limit = utilService.getLimit(queryParams, 100);

	const offset = page * limit;
	const sortArr = [{ property: queryParams.sort, direction: queryParams.dir }];

	// Query for feedback
	const feedback = await Feedback.search(query, null, limit, offset, sortArr, true, {
		path: 'creator',
		select: ['name', 'email']
	});

	const searchResults = {
		totalSize: feedback.count,
		pageNumber: page,
		pageSize: limit,
		totalPages: Math.ceil(feedback.count / limit)
	};

	searchResults.elements = feedback.results;

	return searchResults;
};

module.exports = {
	create,
	search,
	sendFeedback
};
