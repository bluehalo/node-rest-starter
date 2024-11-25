import { HydratedDocument, model, Model, Schema, Types } from 'mongoose';

import { config } from '../../../dependencies';
import getterPlugin from '../../common/mongoose/getter.plugin';
import {
	paginatePlugin,
	Paginateable
} from '../../common/mongoose/paginate.plugin';
import {
	textSearchPlugin,
	TextSearchable
} from '../../common/mongoose/text-search.plugin';

export enum Statuses {
	New = 'New',
	Open = 'Open',
	Closed = 'Closed'
}

export interface IFeedback {
	_id: string;
	body: string;
	type: string;
	url: string;
	os: string;
	browser: string;
	classification: string;
	status: Statuses;
	assignee: string;

	creator: Types.ObjectId;
	created: Date;
	updated: Date;
}

export interface IFeedbackMethods {
	auditCopy(): Record<string, unknown>;
}

export type FeedbackDocument = HydratedDocument<
	IFeedback,
	IFeedbackMethods,
	IFeedbackQueryHelpers
>;

type IFeedbackQueryHelpers = TextSearchable & Paginateable<FeedbackDocument>;

export type FeedbackModel = Model<
	IFeedback,
	IFeedbackQueryHelpers,
	IFeedbackMethods
>;

const FeedbackSchema = new Schema<
	IFeedback,
	FeedbackModel,
	IFeedbackMethods,
	IFeedbackQueryHelpers
>(
	{
		creator: {
			type: Schema.Types.ObjectId,
			ref: 'User'
		},
		body: { type: String },
		type: { type: String },
		url: { type: String },
		os: { type: String },
		browser: { type: String },
		classification: { type: String },
		status: {
			type: String,
			default: Statuses.New,
			enum: Statuses,
			required: true
		},
		assignee: { type: String }
	},
	{
		id: false,
		timestamps: {
			createdAt: 'created',
			updatedAt: 'updated'
		}
	}
);

FeedbackSchema.plugin(getterPlugin);
FeedbackSchema.plugin(paginatePlugin);
FeedbackSchema.plugin(textSearchPlugin);

/**
 * Index declarations
 */

// created datetime index, expires after configured time (false to disable TTL)
if (config.get('feedbackExpires') === false) {
	FeedbackSchema.index({ created: -1 });
} else {
	FeedbackSchema.index(
		{ created: -1 },
		{ expireAfterSeconds: config.get<number>('feedbackExpires') }
	);
}

FeedbackSchema.index({ type: 1 });
FeedbackSchema.index({ creator: 1 });
FeedbackSchema.index({ url: 1 });
FeedbackSchema.index({ os: 1 });
FeedbackSchema.index({ browser: 1 });
FeedbackSchema.index({ status: 1 });
FeedbackSchema.index({ assignee: 1 });

// Text-search index
FeedbackSchema.index({ body: 'text' });

/*****************
 * Lifecycle hooks
 *****************/

/*****************
 * Static Methods
 *****************/

// Copy a team for audit logging
FeedbackSchema.methods.auditCopy = function (): Record<string, unknown> {
	const feedback: Record<string, unknown> = {};
	feedback.creator = this.creator;
	feedback.type = this.type;
	feedback.body = this.body;
	feedback.url = this.url;
	feedback.os = this.os;
	feedback.browser = this.browser;
	feedback.classification = this.classification;
	feedback.status = this.status;
	feedback.assignee = this.assignee;
	return feedback;
};

/**
 * Register the Schema with Mongoose
 */
export const Feedback = model<IFeedback, FeedbackModel>(
	'Feedback',
	FeedbackSchema,
	'feedback'
);
