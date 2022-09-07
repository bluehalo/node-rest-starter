import { HydratedDocument, LeanDocument, Model, Types } from 'mongoose';
import { PaginatePlugin, TextSearchPlugin } from '../../common/mongoose/types';

interface IMessage {
	type: string;
	title: string;
	body: string;
	ackRequired: boolean;
	creator: Types.ObjectId;
	created: Date | number;
	updated: Date | number;
}

export type MessageDocument = HydratedDocument<IMessage>;

export type LeanMessageDocument = LeanDocument<MessageDocument>;

export interface MessageModel
	extends Model<
		MessageDocument,
		TextSearchPlugin & PaginatePlugin<MessageDocument>
	> {
	auditCopy(src: MessageDocument);
	fullCopy(src: MessageDocument);
}

interface IDismissedMessage {
	messageId: Types.ObjectId;
	userId: Types.ObjectId;
	created: Date | number;
}

export type DismissedMessageDocument = HydratedDocument<IDismissedMessage>;

export type LeanDismissedMessageDocument =
	LeanDocument<DismissedMessageDocument>;

export interface DismissedMessageModel
	extends Model<
		DismissedMessageDocument,
		TextSearchPlugin & PaginatePlugin<DismissedMessageDocument>
	> {
	auditCopy(src: DismissedMessageDocument);
}
