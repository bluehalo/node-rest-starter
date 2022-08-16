'use strict';

const deps = require('../../../dependencies'),
	dbs = deps.dbs,
	config = deps.config,
	emailService = deps.emailService,
	util = deps.utilService,
	logger = deps.logger,
	mongoose = require('mongoose');

/**
 * @type {import('./types').FeedbackModel}
 */
const Feedback = dbs.admin.model('Feedback');

/**
 * Import types for reference below
 * @typedef {import('./types').FeedbackDocument} FeedbackDocument
 * @typedef {import('mongoose').PopulateOptions} PopulateOptions
 * @typedef {import('../user/types').UserDocument} UserDocument
 */

/**
 * @param {UserDocument} user
 * @param {*} doc
 * @param {*} userSpec
 * @returns {Promise<FeedbackDocument>}
 */
const create = async (user, doc, userSpec) => {
	const feedback = new Feedback({
		body: doc.body,
		type: doc.type,
		url: doc.url,
		classification: doc.classification,
		creator: user._id,
		browser: userSpec.browser,
		os: userSpec.os
	});

	try {
		return await feedback.save();
	} catch (err) {
		// Log and continue the error
		logger.error(
			{ err: err, feedback: doc },
			'Error trying to persist feedback record to storage.'
		);
		return Promise.reject(err);
	}
};

/**
 * @param {string} id
 * @param {string | PopulateOptions | Array<string | PopulateOptions>} [populate]
 * @returns {Promise<FeedbackDocument | null>}
 */
const read = (id, populate = []) => {
	if (!mongoose.Types.ObjectId.isValid(id)) {
		throw { status: 400, type: 'validation', message: 'Invalid feedback ID' };
	}
	return Feedback.findById(id).populate(populate).exec();
};

/**
 * @param [queryParams]
 * @param {string} [search]
 * @param {import('mongoose').FilterQuery<FeedbackDocument>} [query]
 * @returns {Promise<import('../../common/mongoose/types').PagingResults<FeedbackDocument>>}
 */
const search = (queryParams = {}, search = '', query = {}) => {
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

/**
 *
 * @param {UserDocument} user
 * @param {FeedbackDocument} feedback
 * @param req
 * @returns {Promise<void>}
 */
const sendFeedbackEmail = async (user, feedback, req) => {
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

/**
 * @param {FeedbackDocument} feedback
 * @param {string} assignee
 * @returns {Promise<FeedbackDocument>}
 */
const updateFeedbackAssignee = (feedback, assignee) => {
	feedback.assignee = assignee;
	feedback.updated = Date.now();
	return feedback.save();
};

/**
 * @param {FeedbackDocument} feedback
 * @param {'New' | 'Open' | 'Closed'} status
 * @returns {Promise<FeedbackDocument>}
 */
const updateFeedbackStatus = (feedback, status) => {
	feedback.status = status;
	feedback.updated = Date.now();
	return feedback.save();
};

module.exports = {
	create,
	read,
	search,
	updateFeedbackAssignee,
	updateFeedbackStatus,
	sendFeedbackEmail
};
