import { Schema, model, Types, HydratedDocument, Model } from 'mongoose';

import getterPlugin from '../../common/mongoose/getter.plugin';
import {
	paginatePlugin,
	Paginateable
} from '../../common/mongoose/paginate.plugin';
import {
	textSearchPlugin,
	TextSearchable
} from '../../common/mongoose/text-search.plugin';

export enum MessageTypes {
	INFO = 'INFO',
	WARN = 'WARN',
	ERROR = 'ERROR',
	MOTD = 'MOTD'
}

export interface IMessage {
	_id: Types.ObjectId;
	type: MessageTypes;
	title: string;
	body: string;
	ackRequired: boolean;
	creator: Types.ObjectId;
	created: Date;
	updated: Date;
}

export interface IMessageMethods {
	auditCopy(): Record<string, unknown>;
	fullCopy(): Record<string, unknown>;
}

export type MessageDocument = HydratedDocument<IMessage, IMessageMethods>;

export type MessageModel = Model<
	IMessage,
	TextSearchable & Paginateable<MessageDocument>,
	IMessageMethods
>;

const MessageSchema = new Schema<IMessage, MessageModel, IMessageMethods>(
	{
		title: {
			type: String,
			trim: true,
			required: [true, 'Title is required']
		},
		type: {
			type: String,
			enum: MessageTypes,
			default: MessageTypes.INFO
		},
		body: {
			type: String,
			trim: true,
			required: [true, 'Message is required']
		},
		ackRequired: {
			type: Boolean,
			default: false
		},
		creator: {
			type: Schema.Types.ObjectId,
			ref: 'User'
		}
	},
	{
		timestamps: {
			createdAt: 'created',
			updatedAt: 'updated'
		}
	}
);
MessageSchema.plugin(getterPlugin);
MessageSchema.plugin(paginatePlugin);
MessageSchema.plugin(textSearchPlugin);

/**
 * Index declarations
 */

// MessageSchema.index({created: -1});

// Text-search index
MessageSchema.index({ title: 'text', body: 'text', type: 'text' });

/**
 * Lifecycle Hooks
 */

/**
 * Instance Methods
 */

MessageSchema.methods.auditCopy = function (): Record<string, unknown> {
	return this.fullCopy();
};

MessageSchema.methods.fullCopy = function () {
	const message: Record<string, unknown> = {};
	message.type = this.type;
	message.title = this.title;
	message.body = this.body;
	message.ackRequired = this.ackRequired;
	message.created = this.created;
	message.updated = this.updated;
	message._id = this._id;

	return message;
};

/**
 * Model Registration
 */
const Message = model<IMessage, MessageModel>(
	'Message',
	MessageSchema,
	'messages'
);

export { Message };
