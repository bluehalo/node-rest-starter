import { HydratedDocument, Model, Types } from 'mongoose';
import { PaginatePlugin, TextSearchPlugin } from '../../common/mongoose/types';

type Statuses = {
	New: 'New';
	Open: 'Open';
	Closed: 'Closed';
};

interface IFeedback {
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

export type FeedbackDocument = HydratedDocument<IFeedback>;

export interface FeedbackModel
	extends Model<
		FeedbackDocument,
		TextSearchPlugin & PaginatePlugin<FeedbackDocument>
	> {
	readonly Statuses: Statuses;

	auditCopy(src: FeedbackDocument);
}
