'use strict';

import {
	HydratedDocument,
	LeanDocument,
	model,
	Model,
	Schema,
	Types
} from 'mongoose';
import { Paginateable } from '../../common/mongoose/paginate.plugin';
import getterPlugin from '../../common/mongoose/getter.plugin';
import { config, utilService } from '../../../dependencies';
import { TextSearchable } from '../../common/mongoose/text-search.plugin';

interface IDismissedMessage {
	_id: Types.ObjectId;
	messageId: Types.ObjectId;
	userId: Types.ObjectId;
	created: Date | number;
}

export type DismissedMessageDocument = HydratedDocument<IDismissedMessage>;

export type LeanDismissedMessageDocument =
	LeanDocument<DismissedMessageDocument>;

export interface DismissedMessageModel
	extends Model<
		IDismissedMessage,
		TextSearchable & Paginateable<DismissedMessageDocument>
	> {
	auditCopy(src: Partial<IDismissedMessage>);
}

const DismissedMessageSchema = new Schema<
	IDismissedMessage,
	DismissedMessageModel
>({
	messageId: {
		type: Schema.Types.ObjectId,
		ref: 'Message'
	},
	userId: {
		type: Schema.Types.ObjectId,
		ref: 'User'
	},
	created: {
		type: Date,
		default: () => Date.now(),
		get: utilService.dateParse,
		immutable: true
	}
});

DismissedMessageSchema.plugin(getterPlugin);

/**
 * Index declarations
 */

const expireAfterSeconds = config?.messages?.expireSeconds ?? 2592000; // default to 30 days

DismissedMessageSchema.index({ created: -1 }, { expireAfterSeconds });
DismissedMessageSchema.index({ userId: 1 });

/**
 * Lifecycle Hooks
 */

/**
 * Instance Methods
 */

/**
 * Static Methods
 */
DismissedMessageSchema.statics.auditCopy = function (
	src: Partial<IDismissedMessage>
): Record<string, unknown> {
	const dismissedMessage: Record<string, unknown> = {};
	src = src || {};

	dismissedMessage.messageId = src.messageId;
	dismissedMessage.userId = src.userId;
	dismissedMessage.created = src.created;
	dismissedMessage._id = src._id;

	return dismissedMessage;
};

/**
 * Model Registration
 */
const DismissedMessage = model<IDismissedMessage, DismissedMessageModel>(
	'DismissedMessage',
	DismissedMessageSchema,
	'messages.dismissed'
);

export { DismissedMessage };
