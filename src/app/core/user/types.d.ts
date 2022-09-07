import { BinaryLike } from 'crypto';
import { HydratedDocument, Model, Model } from 'mongoose';
import {
	ContainsSearchPlugin,
	TextSearchPlugin
} from '../../common/mongoose/types';

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
		ContainsSearchPlugin & TextSearchPlugin & PaginatePlugin<IUser>,
		IUserMethods
	> {
	createCopy(user: Record<string, unknown>): Record<string, unknown>;
	auditCopy(
		user: Record<string, unknown>,
		userIP?: string
	): Record<string, unknown>;
}
