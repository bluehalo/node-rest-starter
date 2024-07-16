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
	INotificationMethods,
	INotificationQueryHelpers
>;

type INotificationQueryHelpers = Paginateable<NotificationDocument>;

export type NotificationModel = Model<
	INotification,
	INotificationQueryHelpers,
	INotificationMethods
>;

const NotificationSchema = new Schema<
	INotification,
	NotificationModel,
	INotificationMethods,
	INotificationQueryHelpers
>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'User is required']
		},
		created: {
			type: Date,
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

// created datetime index, expires after configured time (false to disable TTL)
if (config.get('notificationExpires') === false) {
	NotificationSchema.index({ created: -1 });
} else {
	NotificationSchema.index(
		{ created: -1 },
		{ expireAfterSeconds: config.get<number>('notificationExpires') }
	);
}

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
