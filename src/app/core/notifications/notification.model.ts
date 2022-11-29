import { HydratedDocument, model, Model, Schema, Types } from 'mongoose';

import { config } from '../../../dependencies';
import getterPlugin from '../../common/mongoose/getter.plugin';
import {
	paginatePlugin,
	Paginateable
} from '../../common/mongoose/paginate.plugin';

/**
 * Notification Schema
 */

export interface INotification {
	_id: Types.ObjectId;
	user: Types.ObjectId;
	created: Date;
	notificationType: string;
}

export interface INotificationMethods {
	auditCopy(): Record<string, unknown>;
}

export type NotificationDocument = HydratedDocument<
	INotification,
	INotificationMethods
>;

export type NotificationModel = Model<
	INotification,
	Paginateable<NotificationDocument>,
	INotificationMethods
>;

const NotificationSchema = new Schema<INotification>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'User is required']
		},
		created: {
			type: Date,
			expires: config.notificationExpires,
			immutable: true
		}
	},
	{
		discriminatorKey: 'notificationType',
		timestamps: {
			createdAt: 'created',
			updatedAt: false
		}
	}
);

NotificationSchema.plugin(getterPlugin);
NotificationSchema.plugin(paginatePlugin);

/**
 * Index declarations
 */
NotificationSchema.index(
	{ created: -1 },
	{ expireAfterSeconds: config.notificationExpires }
);
NotificationSchema.index({ user: 1, created: -1 });

/**
 * Instance Methods
 */
// Create a filtered copy for auditing
NotificationSchema.methods.auditCopy = function (): Record<string, unknown> {
	const toReturn: Record<string, unknown> = {};
	toReturn._id = this._id;
	toReturn.user = this.user;
	toReturn.notificationType = this.notificationType;

	return toReturn;
};

/**
 * Model Registration
 */
export const Notification = model<INotification, NotificationModel>(
	'Notification',
	NotificationSchema,
	'notifications'
);
