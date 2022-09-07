import { HydratedDocument, Model, Types } from 'mongoose';
import {
	PaginatePlugin,
	TextSearchPlugin
} from '../../../common/mongoose/types';

interface IUserAgreement {
	_id: Types.ObjectId;
	title: string;
	text: string;
	published: Date | number;
	updated: Date | number;
	created: Date | number;
}

export type UserAgreementDocument = HydratedDocument<IUserAgreement>;

export interface UserAgreementModel
	extends Model<
		IUserAgreement,
		TextSearchPlugin & PaginatePlugin<UserAgreementDocument>
	> {
	auditCopy(eua: Record<string, unknown>): Record<string, unknown>;
}
