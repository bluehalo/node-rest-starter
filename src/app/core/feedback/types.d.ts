import { Document, Model, Types } from 'mongoose';
import { PaginatePlugin, TextSearchPlugin } from '../../common/mongoose/types';

type Statuses = {
	New: 'New';
	Open: 'Open';
	Closed: 'Closed';
};

interface IFeedback extends Document {
	_id: string;
	body: string;
	type: string;
	url: string;
	os: string;
	browser: string;
	classification: string;
	status: Statuses[keyof Statuses];
	assignee: string;

	creator: Types.ObjectId;
	created: Date;
	updated: Date | number;
}

export interface FeedbackDocument extends IFeedback {}

type QueryHelpers<T> = TextSearchPlugin & PaginatePlugin<T>;

export interface FeedbackModel
	extends Model<FeedbackDocument, QueryHelpers<FeedbackDocument>> {
	readonly Statuses: Statuses;

	auditCopy(src: FeedbackDocument);
}
