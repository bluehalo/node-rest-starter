import { HydratedDocument, model, Model, Schema, Types } from 'mongoose';

import { utilService } from '../../../../dependencies';
import getterPlugin from '../../../common/mongoose/getter.plugin';
import {
	Paginateable,
	paginatePlugin
} from '../../../common/mongoose/paginate.plugin';
import {
	TextSearchable,
	textSearchPlugin
} from '../../../common/mongoose/text-search.plugin';

export interface IUserAgreement {
	_id: Types.ObjectId;
	title: string;
	text: string;
	published: Date;
	updated: Date;
	created: Date;
}

export interface IUserAgreementMethods {
	auditCopy(): Record<string, unknown>;
}

export type UserAgreementDocument = HydratedDocument<
	IUserAgreement,
	IUserAgreementMethods,
	IUserAgreementQueryHelpers
>;

type IUserAgreementQueryHelpers = TextSearchable &
	Paginateable<UserAgreementDocument>;

export type UserAgreementModel = Model<
	IUserAgreement,
	IUserAgreementQueryHelpers,
	IUserAgreementMethods
>;

const UserAgreementSchema = new Schema<
	IUserAgreement,
	UserAgreementModel,
	IUserAgreementMethods,
	IUserAgreementQueryHelpers
>(
	{
		title: {
			type: String,
			trim: true,
			default: '',
			validate: [utilService.validateNonEmpty, 'Please provide a title']
		},
		text: {
			type: String,
			trim: true,
			default: '',
			validate: [utilService.validateNonEmpty, 'Please provide text']
		},
		published: {
			type: Date,
			default: null
		}
	},
	{
		timestamps: {
			createdAt: 'created',
			updatedAt: 'updated'
		}
	}
);
UserAgreementSchema.plugin(getterPlugin);
UserAgreementSchema.plugin(paginatePlugin);
UserAgreementSchema.plugin(textSearchPlugin);

/**
 * Index declarations
 */
UserAgreementSchema.index({ title: 'text', text: 'text' });
UserAgreementSchema.index({ created: 1 });

/**
 * Lifecycle Hooks
 */

/**
 * Instance Methods
 */
//Copy a user for audit logging
UserAgreementSchema.methods.auditCopy = function (): Record<string, unknown> {
	const eua: Record<string, unknown> = {};
	eua._id = this._id;
	eua.title = this.title;
	eua.text = this.text;
	eua.published = this.published;
	eua.created = this.created;
	eua.updated = this.updated;

	return eua;
};

export const UserAgreement = model<IUserAgreement, UserAgreementModel>(
	'UserAgreement',
	UserAgreementSchema
);
