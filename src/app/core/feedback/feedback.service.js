'use strict';

const
	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	utilService = deps.utilService,
	logger = deps.logger,
	Feedback = dbs.admin.model('Feedback');


const create = async (reqUser, newFeedback) => {
	let feedback = new Feedback({
		body: newFeedback.body,
		type: newFeedback.type,
		url: newFeedback.url,
		classification: newFeedback.classification,
		creator: reqUser._id
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

	let searchResults = {
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
	search
};
