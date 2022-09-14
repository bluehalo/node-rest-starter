import { BinaryLike } from 'crypto';
import { HydratedDocument, Model } from 'mongoose';
import { Paginateable } from '../../common/mongoose/paginate.plugin';
import { TextSearchable } from '../../common/mongoose/text-search.plugin';
import { ContainsSearchable } from '../../common/mongoose/contains-search.plugin';

type UserRoles = {
	user?: boolean;
	editor?: boolean;
	auditor?: boolean;
	admin?: boolean;
};

export interface IUser {
	name: string;

	organization: string;
	organizationLevels: Record<string, unknown>;
	email: string;
	phone: string;
	username: string;
	password: string;
	provider: string;
	providerData: Record<string, unknown>;
	additionalProvidersData: Record<string, unknown>;
	roles: UserRoles;
	canProxy: boolean;
	externalGroups: string[];
	externalRoles: string[];
	bypassAccessCheck: boolean;
	updated: Date | number;
	created: Date;
	messagesAcknowledged: Date;
	alertsViewed: Date;
	resetPasswordToken: string;
	resetPasswordExpires: Date | number;
	acceptedEua: Date | number;
	lastLogin: Date | number;
	lastLoginWithAccess: Date | number;
	newFeatureDismissed: Date;
	preferences: Record<string, unknown>;
	salt: BinaryLike;
}

interface IUserMethods {
	authenticate(password: string): boolean;
	hashPassword(password: string): string;
}

export type UserDocument = HydratedDocument<IUser, IUserMethods>;

export interface UserModel
	extends Model<
		IUser,
		ContainsSearchable & TextSearchable & Paginateable<UserDocument>,
		IUserMethods
	> {
	createCopy(user: Partial<IUser>): Record<string, unknown>;
	auditCopy(user: Partial<IUser>, userIP?: string): Record<string, unknown>;
}
