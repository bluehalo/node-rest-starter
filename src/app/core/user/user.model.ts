import crypto from 'node:crypto';

import { type Static, Type } from '@fastify/type-provider-typebox';
import _ from 'lodash';
import mongoose, {
	HydratedDocument,
	model,
	Model,
	PreSaveMiddlewareFunction,
	Schema,
	SchemaDefinition
} from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';

import { config, utilService as util } from '../../../dependencies';
import {
	ContainsSearchable,
	containsSearchPlugin
} from '../../common/mongoose/contains-search.plugin';
import getterPlugin from '../../common/mongoose/getter.plugin';
import {
	Paginateable,
	paginatePlugin
} from '../../common/mongoose/paginate.plugin';
import {
	TextSearchable,
	textSearchPlugin
} from '../../common/mongoose/text-search.plugin';
import { DateTimeType, ObjectIdType } from '../core.types';
import { TeamRoleSchema, TeamRoleType } from '../teams/team-role.model';

/**
 * Validation
 */

// Validate the password
const validatePassword = function (user: UserDocument, password: string) {
	let toReturn = true;

	// only care if it's local
	if (user.provider === 'local') {
		toReturn = password?.length >= 6;
	}

	return toReturn;
};
const passwordMessage = 'Password must be at least 6 characters long';

/**
 * User Roles
 */
export const Roles = config.get<string[]>('auth.roles');

const roleObject: SchemaDefinition = {};
for (const role of Roles) {
	roleObject[role] = {
		type: Boolean,
		default:
			config.get<Record<string, boolean>>('auth.defaultRoles')[role] ?? false
	};
}

const roleSchemaDef = new mongoose.Schema(roleObject, { _id: false });

const UserRolesType = Type.Union([
	Type.Object({
		user: Type.Optional(Type.Boolean()),
		editor: Type.Optional(Type.Boolean()),
		auditor: Type.Optional(Type.Boolean()),
		admin: Type.Optional(Type.Boolean()),
		machine: Type.Optional(Type.Boolean())
	}),
	Type.Record(Type.String(), Type.Boolean())
]);

export const UserType = Type.Object({
	_id: ObjectIdType,
	name: Type.String(),
	organization: Type.String(),
	organizationLevels: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
	email: Type.String(),
	phone: Type.Optional(Type.String()),
	username: Type.String(),
	password: Type.String(),
	provider: Type.String(),
	providerData: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
	additionalProvidersData: Type.Optional(
		Type.Record(Type.String(), Type.Unknown())
	),
	roles: UserRolesType,
	localRoles: Type.Optional(UserRolesType),
	canProxy: Type.Optional(Type.Boolean()),
	canMasquerade: Type.Optional(Type.Boolean()),
	externalGroups: Type.Optional(Type.Array(Type.String())),
	externalRoles: Type.Optional(Type.Array(Type.String())),
	bypassAccessCheck: Type.Optional(Type.Boolean()),
	updated: DateTimeType,
	created: DateTimeType,
	messagesAcknowledged: Type.Optional(Type.Union([DateTimeType, Type.Null()])),
	alertsViewed: Type.Optional(DateTimeType),
	resetPasswordToken: Type.Optional(Type.String()),
	resetPasswordExpires: Type.Optional(DateTimeType),
	acceptedEua: Type.Optional(Type.Union([DateTimeType, Type.Null()])),
	lastLogin: Type.Optional(Type.Union([DateTimeType, Type.Null()])),
	lastLoginWithAccess: Type.Optional(Type.Union([DateTimeType, Type.Null()])),
	newFeatureDismissed: Type.Optional(Type.Union([DateTimeType, Type.Null()])),
	preferences: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
	salt: Type.Optional(Type.String()),
	teams: Type.Optional(Type.Array(TeamRoleType))
});

export type IUser = Static<typeof UserType>;

interface IUserMethods {
	fullCopy(): IUser;
	filteredCopy(): Record<string, unknown>;
	auditCopy(userIP?: string): Record<string, unknown>;

	authenticate(password: string): boolean;
	hashPassword(password: string): string;
}

export type UserDocument = HydratedDocument<
	IUser,
	IUserMethods,
	IUserQueryHelpers
>;

type IUserQueryHelpers = ContainsSearchable &
	TextSearchable &
	Paginateable<UserDocument>;

export interface UserModel
	extends Model<IUser, IUserQueryHelpers, IUserMethods> {
	createCopy(user: Partial<IUser>): Partial<IUser>;
}

const UserSchema = new Schema<
	IUser,
	UserModel,
	IUserMethods,
	IUserQueryHelpers
>(
	{
		name: {
			type: String,
			trim: true,
			required: [true, 'Name is required']
		},
		organization: {
			type: String,
			trim: true,
			required: [true, 'Organization is required']
		},
		organizationLevels: {
			type: Object
		},
		email: {
			type: String,
			trim: true,
			required: [true, 'Email is required'],
			match: [util.emailMatcher, 'A valid email address is required']
		},
		phone: {
			type: String,
			trim: true,
			default: '',
			match: [
				/.+@.+\..+/,
				'A valid phone number and cellular provider is required'
			],
			required: false
		},
		username: {
			type: String,
			trim: true,
			unique: true,
			required: [true, 'Username is required']
		},
		password: {
			type: String,
			default: '',
			validate: [validatePassword, passwordMessage]
		},
		salt: {
			type: String
		},
		provider: {
			type: String,
			required: [true, 'Provider is required']
		},
		providerData: {},
		additionalProvidersData: {},
		roles: {
			type: roleSchemaDef,
			default: () => ({})
		},
		canProxy: {
			type: Boolean,
			default: false
		},
		canMasquerade: {
			type: Boolean,
			default: false
		},
		externalGroups: {
			type: [],
			default: []
		},
		externalRoles: {
			type: [],
			default: []
		},
		bypassAccessCheck: {
			type: Boolean,
			default: false
		},
		messagesAcknowledged: {
			type: Date,
			default: null
		},
		alertsViewed: {
			type: Date,
			default: () => Date.now()
		},
		/* For reset password */
		resetPasswordToken: {
			type: String
		},
		resetPasswordExpires: {
			type: Date
		},
		acceptedEua: {
			type: Date,
			default: null
		},
		lastLogin: {
			type: Date,
			default: null
		},
		lastLoginWithAccess: {
			type: Date,
			default: null
		},
		newFeatureDismissed: {
			type: Date,
			default: null
		},
		preferences: {
			type: {}
		},
		teams: [TeamRoleSchema]
	},
	{
		timestamps: {
			createdAt: 'created',
			updatedAt: 'updated'
		}
	}
);

/**
 * Plugin declarations
 */
UserSchema.plugin(getterPlugin);
UserSchema.plugin(
	uniqueValidator as unknown as (schema: typeof UserSchema) => void
);
UserSchema.plugin(paginatePlugin);
UserSchema.plugin(containsSearchPlugin, {
	fields: ['name', 'username']
});
UserSchema.plugin(textSearchPlugin);

/**
 * Index declarations
 */
// Text-search index
UserSchema.index({ name: 'text', email: 'text', username: 'text' });

/**
 * Lifecycle Hooks
 */

const preSave: PreSaveMiddlewareFunction<UserDocument> = function (this, next) {
	// If the password is modified and it is valid, then re- salt/hash it
	if (this.isModified('password') && validatePassword(this, this.password)) {
		this.salt = crypto.randomBytes(16).toString('base64');
		this.password = this.hashPassword(this.password);
	}

	next();
};
UserSchema.pre('save', preSave);

/**
 * Instance Methods
 */

/**
 * Hash Password
 * @returns {string} An SHA1 hash of the password.
 */
UserSchema.methods.hashPassword = function (password: string) {
	if (this.salt && password) {
		return crypto
			.pbkdf2Sync(password, this.salt, 10_000, 64, 'SHA1')
			.toString('base64');
	}
	return password;
};

/**
 * Authenticate a password against the user
 * @param password Password attempt.
 * @returns Whether or not the password is correct.
 */
UserSchema.methods.authenticate = function (password: string): boolean {
	return this.password === this.hashPassword(password);
};

// Copy a user for audit logging
UserSchema.methods.auditCopy = function (userIP?: string) {
	const toReturn: Record<string, unknown> = {};

	const asObject = this.toObject();

	toReturn._id = this._id;
	toReturn.name = this.name;
	toReturn.username = this.username;
	toReturn.organization = this.organization;
	toReturn.organizationLevels = this.organizationLevels;
	toReturn.email = this.email;
	toReturn.phone = this.phone;
	toReturn.messagesAcknowledged = this.messagesAcknowledged;
	toReturn.alertsViewed = this.alertsViewed;
	toReturn.newFeatureDismissed = this.newFeatureDismissed;
	toReturn.canProxy = this.canProxy;
	toReturn.canMasquerade = this.canMasquerade;
	toReturn.teams = asObject.teams;
	toReturn.roles = asObject.roles;
	toReturn.bypassAccessCheck = this.bypassAccessCheck;

	if (userIP) {
		toReturn.ip = userIP;
	}
	if (this.providerData?.dn) {
		toReturn.dn = this.providerData.dn;
	}
	if (this.preferences) {
		toReturn.preferences = this.preferences;
	}

	return toReturn;
};

// Full Copy of a User (admin)
UserSchema.methods.fullCopy = function () {
	const toReturn: IUser = this.toObject();
	if (_.has(toReturn, 'password')) {
		delete toReturn.password;
	}
	if (_.has(toReturn, 'salt')) {
		delete toReturn.salt;
	}
	return toReturn;
};

// Filtered Copy of a User (public)
UserSchema.methods.filteredCopy = function () {
	const toReturn: Record<string, unknown> = {};

	toReturn._id = this._id;
	toReturn.name = this.name;
	toReturn.username = this.username;
	toReturn.organizationLevels = this.organizationLevels;
	toReturn.lastLogin = this.lastLogin;

	// The below fields (and other) are available, but shouldn't
	// necessarily be exposed to other users.

	// toReturn.created = this.created;
	// toReturn.messagesAcknowledged = this.messagesAcknowledged;
	// toReturn.alertsViewed = this.alertsViewed;
	// toReturn.newFeatureDismissed = this.newFeatureDismissed;

	if (this.providerData) {
		toReturn.providerData = {
			dn: this.providerData.dn
		};
	}

	if (this.preferences) {
		toReturn.preferences = this.preferences;
	}

	return toReturn;
};

/**
 * Static Methods
 */
// Copy User for creation
UserSchema.statics.createCopy = function (
	user: Partial<IUser>
): Partial<IUser> {
	const toReturn: Partial<IUser> = {};

	toReturn.name = user.name;
	toReturn.organization = user.organization;
	toReturn.organizationLevels = user.organizationLevels;
	toReturn.email = user.email;
	toReturn.phone = user.phone;
	toReturn.username = user.username;
	toReturn.password = user.password;
	toReturn.messagesAcknowledged = user.messagesAcknowledged;
	toReturn.alertsViewed = user.alertsViewed;
	toReturn.newFeatureDismissed = user.newFeatureDismissed;

	if (user.preferences) {
		toReturn.preferences = user.preferences;
	}

	return toReturn;
};

/**
 * Model Registration
 */
export const User = model<IUser, UserModel>('User', UserSchema);
