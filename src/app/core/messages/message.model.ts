'use strict';

import {
	Schema,
	model,
	Types,
	HydratedDocument,
	LeanDocument,
	Model
} from 'mongoose';
import getterPlugin from '../../common/mongoose/getter.plugin';
import paginatePlugin from '../../common/mongoose/paginate.plugin';
import textSearchPlugin from '../../common/mongoose/text-search.plugin';
import { utilService } from '../../../dependencies';
import { PaginatePlugin, TextSearchPlugin } from '../../common/mongoose/types';

interface IMessage {
	_id: Types.ObjectId;
	type: 'INFO' | 'WARN' | 'ERROR' | 'MOTD';
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
	extends Model<IMessage, TextSearchPlugin & PaginatePlugin<MessageDocument>> {
	auditCopy(src: Partial<IMessage>);
	fullCopy(src: Partial<IMessage>);
}

const MessageSchema = new Schema<IMessage, MessageModel>({
	title: {
		type: String,
		trim: true,
		required: [true, 'Title is required']
	},
	type: {
		type: String,
		enum: ['INFO', 'WARN', 'ERROR', 'MOTD'],
		default: 'INFO'
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
	updated: {
		type: Date,
		get: utilService.dateParse
	},
	created: {
		type: Date,
		default: () => Date.now(),
		get: utilService.dateParse,
		immutable: true
	},
	creator: {
		type: Schema.Types.ObjectId,
		ref: 'User',
		immutable: true
	}
});
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

/**
 * Static Methods
 */
MessageSchema.statics.auditCopy = function (
	src: Partial<IMessage>
): Record<string, unknown> {
	const newMessage: Record<string, unknown> = {};
	src = src || {};

	newMessage.type = src.type;
	newMessage.title = src.title;
	newMessage.body = src.body;
	newMessage.ackRequired = src.ackRequired;
	newMessage.created = src.created;
	newMessage.updated = src.updated;
	newMessage._id = src._id;

	return newMessage;
};

MessageSchema.statics.fullCopy = function (
	src: Partial<IMessage>
): Record<string, unknown> {
	const newMessage: Record<string, unknown> = {};
	src = src || {};

	newMessage.type = src.type;
	newMessage.title = src.title;
	newMessage.body = src.body;
	newMessage.ackRequired = src.ackRequired;
	newMessage.created = src.created;
	newMessage.updated = src.updated;
	newMessage._id = src._id;

	return newMessage;
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
