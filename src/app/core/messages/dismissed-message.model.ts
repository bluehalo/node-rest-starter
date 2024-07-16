import { HydratedDocument, model, Model, Schema, Types } from 'mongoose';

import { config } from '../../../dependencies';
import getterPlugin from '../../common/mongoose/getter.plugin';
import { Paginateable } from '../../common/mongoose/paginate.plugin';
import { TextSearchable } from '../../common/mongoose/text-search.plugin';

export interface IDismissedMessage {
	_id: Types.ObjectId;
	messageId: Types.ObjectId;
	userId: Types.ObjectId;
	created: Date;
}

export interface IDismissedMessageMethods {
	auditCopy(): Record<string, unknown>;
}

export type DismissedMessageDocument = HydratedDocument<
	IDismissedMessage,
	IDismissedMessageMethods,
	IDismissedMessageQueryHelpers
>;

type IDismissedMessageQueryHelpers = TextSearchable &
	Paginateable<DismissedMessageDocument>;

export type DismissedMessageModel = Model<
	IDismissedMessage,
	IDismissedMessageQueryHelpers,
	IDismissedMessageMethods
>;

const DismissedMessageSchema = new Schema<
	IDismissedMessage,
	DismissedMessageModel,
	IDismissedMessageMethods,
	IDismissedMessageQueryHelpers
>(
	{
		messageId: {
			type: Schema.Types.ObjectId,
			ref: 'Message'
		},
		userId: {
			type: Schema.Types.ObjectId,
			ref: 'User'
		}
	},
	{
		timestamps: {
			createdAt: 'created',
			updatedAt: false
		}
	}
);

DismissedMessageSchema.plugin(getterPlugin);

/**
 * Index declarations
 */

const expireAfterSeconds = config.get<number>('messages.expireSeconds');

DismissedMessageSchema.index({ created: -1 }, { expireAfterSeconds });
DismissedMessageSchema.index({ userId: 1 });

/**
 * Lifecycle Hooks
 */

/**
 * Instance Methods
 */
DismissedMessageSchema.methods.auditCopy = function () {
	const dismissedMessage: Record<string, unknown> = {};
	dismissedMessage._id = this._id;
	dismissedMessage.messageId = this.messageId;
	dismissedMessage.userId = this.userId;
	dismissedMessage.created = this.created;

	return dismissedMessage;
};

/**
 * Model Registration
 */
export const DismissedMessage = model<IDismissedMessage, DismissedMessageModel>(
	'DismissedMessage',
	DismissedMessageSchema,
	'messages.dismissed'
);
