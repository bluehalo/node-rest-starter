'use strict';

const mongoose = require('mongoose'),
	{
		dbs,
		config,
		emailService,
		logger,
		utilService
	} = require('../../../dependencies');

/**
 * Import types for reference below
 *
 * @typedef {import('mongoose').PopulateOptions} PopulateOptions
 * @typedef {import('./types').FeedbackDocument} FeedbackDocument
 * @typedef {import('./types').FeedbackModel} FeedbackModel
 * @typedef {import('../user/types').UserDocument} UserDocument
 */

class FeedbackService {
	constructor() {
		/**
		 * @type {FeedbackModel}
		 */
		this.model = dbs.admin.model('Feedback');
	}

	/**
	 * @param {UserDocument} user
	 * @param {*} doc
	 * @param {*} userSpec
	 * @returns {Promise<FeedbackDocument>}
	 */
	async create(user, doc, userSpec) {
		const feedback = new this.model({
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
	}

	/**
	 * @param {string} id
	 * @param {string | PopulateOptions | Array<string | PopulateOptions>} [populate]
	 * @returns {Promise<FeedbackDocument | null>}
	 */
	read(id, populate = []) {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw { status: 400, type: 'validation', message: 'Invalid feedback ID' };
		}
		return this.model
			.findById(id)
			.populate(/** @type {string} */ (populate))
			.exec();
	}

	/**
	 * @param [queryParams]
	 * @param {string} [search]
	 * @param {import('mongoose').FilterQuery<FeedbackDocument>} [query]
	 * @returns {Promise<import('../../common/mongoose/types').PagingResults<FeedbackDocument>>}
	 */
	search(queryParams = {}, search = '', query = {}) {
		const page = utilService.getPage(queryParams);
		const limit = utilService.getLimit(queryParams, 100);
		const sort = utilService.getSortObj(queryParams);

		// Query for feedback
		return this.model
			.find(query)
			.textSearch(search)
			.sort(sort)
			.populate({
				path: 'creator',
				select: ['username', 'organization', 'name', 'email']
			})
			.paginate(limit, page);
	}

	/**
	 * @param {UserDocument} user
	 * @param {FeedbackDocument} feedback
	 * @param req
	 * @returns {Promise<void>}
	 */
	async sendFeedbackEmail(user, feedback, req) {
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
	}

	/**
	 * @param {FeedbackDocument} feedback
	 * @param {string} assignee
	 * @returns {Promise<FeedbackDocument>}
	 */
	updateFeedbackAssignee(feedback, assignee) {
		feedback.assignee = assignee;
		return feedback.save();
	}

	/**
	 * @param {FeedbackDocument} feedback
	 * @param {'New' | 'Open' | 'Closed'} status
	 * @returns {Promise<FeedbackDocument>}
	 */
	updateFeedbackStatus(feedback, status) {
		feedback.status = status;
		return feedback.save();
	}
}

module.exports = new FeedbackService();
