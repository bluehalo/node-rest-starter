import { Static, Type } from '@fastify/type-provider-typebox';
import { Schema, model, HydratedDocument, Model } from 'mongoose';

import getterPlugin from '../../common/mongoose/getter.plugin';
import {
	paginatePlugin,
	Paginateable
} from '../../common/mongoose/paginate.plugin';
import {
	textSearchPlugin,
	TextSearchable
} from '../../common/mongoose/text-search.plugin';
import { DateTimeType, ObjectIdType } from '../core.types';

export enum MessageTypes {
	INFO = 'INFO',
	WARN = 'WARN',
	ERROR = 'ERROR',
	MOTD = 'MOTD'
}

export const MessageType = Type.Object({
	_id: ObjectIdType,
	type: Type.Enum(MessageTypes),
	title: Type.String(),
	body: Type.String(),
	ackRequired: Type.Boolean(),
	creator: ObjectIdType,
	created: DateTimeType,
	updated: DateTimeType
});

export type IMessage = Static<typeof MessageType>;

export interface IMessageMethods {
	auditCopy(): Record<string, unknown>;
	fullCopy(): Record<string, unknown>;
}

export type MessageDocument = HydratedDocument<
	IMessage,
	IMessageMethods,
	IMessageQueryHelpers
>;

type IMessageQueryHelpers = TextSearchable & Paginateable<MessageDocument>;

export type MessageModel = Model<
	IMessage,
	IMessageQueryHelpers,
	IMessageMethods
>;

const MessageSchema = new Schema<
	IMessage,
	MessageModel,
	IMessageMethods,
	IMessageQueryHelpers
>(
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
export const Message = model<IMessage, MessageModel>(
	'Message',
	MessageSchema,
	'messages'
);
