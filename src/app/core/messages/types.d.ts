import { Document, LeanDocument, Model, Types } from 'mongoose';
import { PaginatePlugin, TextSearchPlugin } from '../../common/mongoose/types';

interface IMessage extends Document {
	_id: Types.ObjectId;
	title: string;
	body: string;
	ackRequired: boolean;
	creator: Types.ObjectId;
	created: Date | number;
	updated: Date | number;
}

export interface MessageDocument extends IMessage {}

export type LeanMessageDocument = LeanDocument<MessageDocument>;

type QueryHelpers<T> = TextSearchPlugin & PaginatePlugin<T>;

export interface MessageModel
	extends Model<MessageDocument, QueryHelpers<MessageDocument>> {
	auditCopy(src: MessageDocument);
	fullCopy(src: MessageDocument);
}

interface IDismissedMessage extends Document {
	messageId: Types.ObjectId;
	userId: Types.ObjectId;
	created: number;
}

export interface DismissedMessageDocument extends IDismissedMessage {}

export type LeanDismissedMessageDocument = LeanDocument<DismissedMessageDocument>;

export interface DismissedMessageModel
	extends Model<DismissedMessageDocument, QueryHelpers<MessageDocument>> {
	auditCopy(src: DismissedMessageDocument);
}
