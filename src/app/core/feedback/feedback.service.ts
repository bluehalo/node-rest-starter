import { Readable } from 'stream';

import { FilterQuery, PopulateOptions, Types } from 'mongoose';

import {
	Feedback,
	FeedbackDocument,
	FeedbackModel,
	Statuses
} from './feedback.model';
import {
	config,
	emailService,
	logger,
	utilService
} from '../../../dependencies';
import { BadRequestError, NotFoundError } from '../../common/errors';
import { PagingResults } from '../../common/mongoose/paginate.plugin';
import { UserDocument } from '../user/user.model';

class FeedbackService {
	constructor(private model: FeedbackModel) {}

	create(
		user: UserDocument,
		doc: Record<string, unknown>,
		userSpec: Record<string, unknown>
	): Promise<FeedbackDocument> {
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
			return feedback.save();
		} catch (err) {
			// Log and continue the error
			logger.error(
				{ err: err, feedback: doc },
				'Error trying to persist feedback record to storage.'
			);
			return Promise.reject(err);
		}
	}

	read(
		id: string | Types.ObjectId,
		populate:
			| string
			| string[]
			| PopulateOptions
			| Array<string | PopulateOptions> = []
	): Promise<FeedbackDocument | null> {
		if (!Types.ObjectId.isValid(id)) {
			return Promise.reject(new NotFoundError('Invalid feedback ID'));
		}
		return this.model
			.findById(id)
			.populate(populate as string[])
			.exec();
	}

	search(
		queryParams = {},
		search = '',
		query: FilterQuery<FeedbackDocument> = {},
		populate:
			| string
			| string[]
			| PopulateOptions
			| Array<string | PopulateOptions> = []
	): Promise<PagingResults<FeedbackDocument>> {
		const page = utilService.getPage(queryParams);
		const limit = utilService.getLimit(queryParams, 100);
		const sort = utilService.getSortObj(queryParams);

		// Query for feedback
		return this.model
			.find(query)
			.textSearch(search)
			.sort(sort)
			.populate(populate as string[])
			.paginate(limit, page);
	}

	cursorSearch(
		queryParams = {},
		search = '',
		query: FilterQuery<FeedbackDocument> = {},
		populate:
			| string
			| string[]
			| PopulateOptions
			| Array<string | PopulateOptions> = []
	): Readable {
		const sort = utilService.getSortObj(queryParams);

		return this.model
			.find(query)
			.textSearch(search)
			.sort(sort)
			.populate(populate as string[])
			.cursor();
	}

	async sendFeedbackEmail(
		user: UserDocument,
		feedback: FeedbackDocument,
		req: unknown
	): Promise<void> {
		if (
			null == user ||
			null == feedback.body ||
			null == feedback.type ||
			null == feedback.url
		) {
			return Promise.reject(new BadRequestError('Invalid submission.'));
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

	updateFeedbackAssignee(
		feedback: FeedbackDocument,
		assignee: string
	): Promise<FeedbackDocument> {
		feedback.assignee = assignee;
		return feedback.save();
	}

	updateFeedbackStatus(
		feedback: FeedbackDocument,
		status: Statuses
	): Promise<FeedbackDocument> {
		feedback.status = status;
		return feedback.save();
	}
}

export = new FeedbackService(Feedback);
