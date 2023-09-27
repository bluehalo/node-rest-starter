import crypto, { BinaryLike } from 'crypto';

import _ from 'lodash';
import mongoose, {
	HydratedDocument,
	model,
	Model,
	Schema,
	Types
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
import { TeamRoles, TeamRoleSchema } from '../teams/team-role.model';

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
export const Roles = (config?.auth?.roles as string[]) ?? [
	'user',
	'editor',
	'auditor',
	'admin'
];

const roleObject = Roles.reduce(
	(obj, role) => {
		obj[role] = {
			type: Boolean,
			default: config?.auth?.defaultRoles?.[role] ?? false
		};
		return obj;
	},
	{ _id: false }
);

const roleSchemaDef = new mongoose.Schema(roleObject);

type UserRoles = {
	user?: boolean;
	editor?: boolean;
	auditor?: boolean;
	admin?: boolean;
	machine?: boolean;
};

export interface IUser {
	_id: Types.ObjectId;
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
	localRoles?: UserRoles;
	canProxy: boolean;
	canMasquerade: boolean;
	externalGroups: string[];
	externalRoles: string[];
	bypassAccessCheck: boolean;
	updated: Date;
	created: Date;
	messagesAcknowledged: Date;
	alertsViewed: Date;
	resetPasswordToken: string;
	resetPasswordExpires: Date;
	acceptedEua: Date;
	lastLogin: Date;
	lastLoginWithAccess: Date;
	newFeatureDismissed: Date;
	preferences: Record<string, unknown>;
	salt: BinaryLike;
	teams: { _id: Types.ObjectId; role: TeamRoles }[];
}

interface IUserMethods {
	fullCopy(): IUser;
	filteredCopy(): Record<string, unknown>;
	auditCopy(userIP?: string): Record<string, unknown>;

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
	createCopy(user: Partial<IUser>): Partial<IUser>;
}

const UserSchema = new Schema(
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
			// TODO: either change the default to null or leave dateParse?
			default: 0,
			get: util.dateParse
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
UserSchema.plugin(uniqueValidator);
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

const preSave = function (this: UserDocument, next) {
	// If the password is modified and it is valid, then re- salt/hash it
	if (this.isModified('password') && validatePassword(this, this.password)) {
		this.salt = Buffer.from(
			crypto.randomBytes(16).toString('base64'),
			'base64'
		);
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
			.pbkdf2Sync(password, this.salt, 10000, 64, 'SHA1')
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
	toReturn.teams = _.cloneDeep(this.teams?.toObject());
	toReturn.roles = _.cloneDeep(this.roles?.toObject());
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
