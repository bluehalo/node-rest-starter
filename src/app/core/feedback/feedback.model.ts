'use strict';

import { HydratedDocument, model, Model, Schema, Types } from 'mongoose';
import getterPlugin from '../../common/mongoose/getter.plugin';
import {
	paginatePlugin,
	Paginateable
} from '../../common/mongoose/paginate.plugin';
import {
	textSearchPlugin,
	TextSearchable
} from '../../common/mongoose/text-search.plugin';

const Statuses = Object.freeze({
	new: 'New',
	open: 'Open',
	closed: 'Closed'
});

export interface IFeedback {
	_id: string;
	body: string;
	type: string;
	url: string;
	os: string;
	browser: string;
	classification: string;
	status: typeof Statuses[keyof typeof Statuses];
	assignee: string;

	creator: Types.ObjectId;
	created: Date;
	updated: Date;
}

export type FeedbackDocument = HydratedDocument<IFeedback>;

export type FeedbackModel = Model<
	IFeedback,
	TextSearchable & Paginateable<FeedbackDocument>
>;

const FeedbackSchema = new Schema<IFeedback, FeedbackModel>(
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
			default: Statuses.new,
			enum: Object.values(Statuses),
			required: true
		},
		assignee: { type: String }
	},
	{
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

// Created datetime index, expires after 180 days

FeedbackSchema.index({ created: -1 }, { expireAfterSeconds: 15552000 });
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

/**
 * Register the Schema with Mongoose
 */
const Feedback = model<IFeedback, FeedbackModel>(
	'Feedback',
	FeedbackSchema,
	'feedback'
);

export { Feedback };
