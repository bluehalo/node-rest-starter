import { Document, Model, model, Types, Schema, Query, Mongoose } from "mongoose"

type UserRoles = {
	user?: boolean;
	editor?: boolean;
	auditor?: boolean;
	admin?: boolean;
};

interface IUser extends Document {
	name: string;

	organization: string;
	organizationLevels: Object;
	email: string;
	phone: string;
	username: string;
	password: string;
	provider: string;
	providerData: Object;
	additionalProvidersData: Object;
	roles: UserRoles;
	canProxy: boolean;
	externalGroups: string[];
	externalRoles: string[];
	bypassAccessCheck: boolean;
	updated: Date;
	created: Date;
	messagesAcknowledged: Date;
	alertsViewed: Date;
	resetPasswordToken: string;
	resetPasswordExpires: string;
	acceptedEua: Date;
	lastLogin: Date | number;
	newFeatureDismissed: Date;
	preferences: Object;
	salt?: crypto.BinaryLike;
}

export interface UserDocument extends IUser {
	authenticate(password: string): boolean;
	hashPassword(password: string): string;
}

export interface UserModel extends Model<UserDocument> {
	createCopy(user: Object): Object;
	auditCopy(user: Object, userIP?: string): Object;
}
