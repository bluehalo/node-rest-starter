import { HydratedDocument, model, Model, Schema, Types } from 'mongoose';
import { config, utilService } from '../../../dependencies';
import getterPlugin from '../../common/mongoose/getter.plugin';
import paginatePlugin from '../../common/mongoose/paginate.plugin';
import { PaginatePlugin } from '../../common/mongoose/types';

/**
 * Notification Schema
 */

export interface INotification {
	_id: Types.ObjectId;
	user: Types.ObjectId;
	created: Date | number;
	notificationType: string;
}

export type NotificationDocument = HydratedDocument<INotification>;

export interface NotificationModel
	extends Model<INotification, PaginatePlugin<NotificationDocument>> {
	auditCopy(src: Partial<INotification>);
}

const NotificationSchema = new Schema<INotification>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'User is required']
		},
		created: {
			type: Date,
			default: () => Date.now(),
			get: utilService.dateParse,
			expires: config.notificationExpires,
			immutable: true
		}
	},
	{ discriminatorKey: 'notificationType' }
);

NotificationSchema.plugin(getterPlugin);
NotificationSchema.plugin(paginatePlugin);

/**
 * Index declarations
 */

NotificationSchema.index({ user: 1, created: -1 });

/**
 * Static Methods
 */

// Create a filtered copy for auditing
NotificationSchema.statics.auditCopy = function (
	src: Partial<INotification>
): Record<string, unknown> {
	const toReturn: Record<string, unknown> = {};
	src = src || {};

	toReturn._id = src._id;
	toReturn.user = src.user;
	toReturn.notificationType = src.notificationType;

	return toReturn;
};

/**
 * Model Registration
 */
const Notification = model<INotification, NotificationModel>(
	'Notification',
	NotificationSchema,
	'notifications'
);

export { Notification };
