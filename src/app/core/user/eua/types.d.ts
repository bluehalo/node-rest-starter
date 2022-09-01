import { Document, Model } from 'mongoose';
import { TextSearchPlugin } from '../../../common/mongoose/types';

interface IUserAgreement extends Document {
	title: string;
	text: string;
	published: Date | number;
	updated: Date | number;
	created: Date | number;
}

export type UserAgreementDocument = IUserAgreement;

type QueryHelpers<T> = TextSearchPlugin & PaginatePlugin<T> & PagedStreamPlugin;

export interface UserAgreementModel
	extends Model<UserAgreementDocument, QueryHelpers<UserAgreementDocument>> {
	auditCopy(eua: Object): Object;
}
