import { HydratedDocument, Model, Types } from 'mongoose';
import { Paginateable } from '../../../common/mongoose/paginate.plugin';
import { TextSearchable } from '../../../common/mongoose/text-search.plugin';

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
		TextSearchable & Paginateable<UserAgreementDocument>
	> {
	auditCopy(eua: Record<string, unknown>): Record<string, unknown>;
}
