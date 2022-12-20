'use strict';

const _ = require('lodash'),
	crypto = require('crypto'),
	mongoose = require('mongoose'),
	uniqueValidator = require('mongoose-unique-validator'),
	deps = require('../../../dependencies'),
	config = deps.config,
	util = deps.utilService,
	getterPlugin = require('../../common/mongoose/getter.plugin'),
	{ paginatePlugin } = require('../../common/mongoose/paginate.plugin'),
	{
		containsSearchPlugin
	} = require('../../common/mongoose/contains-search.plugin'),
	{ textSearchPlugin } = require('../../common/mongoose/text-search.plugin');
const { TeamRoleSchema } = require('../teams/team-role.model');

/**
 * Import types for reference below
 * @typedef {import('./types').IUser} IUser
 * @typedef {import('./types').UserDocument} UserDocument
 * @typedef {import('./types').UserModel} UserModel
 */

/**
 * Validation
 */

// Validate the password
const validatePassword = function (password) {
	let toReturn = true;

	// only care if it's local
	if (this.provider === 'local') {
		toReturn = null != password && password.length >= 6;
	}

	return toReturn;
};
const passwordMessage = 'Password must be at least 6 characters long';

/**
 * User Roles
 */
const roles = config?.auth?.roles ?? ['user', 'editor', 'auditor', 'admin'];
const roleObject = roles.reduce((obj, role) => {
	obj[role] = { type: Boolean, default: false };
	return obj;
}, {});

const roleSchemaDef = new mongoose.Schema(roleObject);

/**
 * User Schema
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - name
 *         - organization
 *         - email
 *         - username
 *         - provider
 *       properties:
 *         phone:
 *           type: string
 *         canProxy:
 *           type: boolean
 *           default: false
 *         externalGroups:
 *           type: array
 *           items:
 *             type: string
 *         externalRoles:
 *           type: array
 *           items:
 *             type: string
 *         bypassAccessCheck:
 *           type: boolean
 *           default: false
 *         messsagesAcknowledged:
 *           type: integer
 *           minimum: 0
 *         acceptedEua:
 *           type: boolean
 *           default: null
 *         lastLogin:
 *           type: integer
 *         lastLoginWithAccess:
 *           type: integer
 *         newFeatureDismissed:
 *           type: boolean
 *           default: null
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         organization:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         username:
 *           type: string
 *         created:
 *           type: integer
 *         updated:
 *           type: integer
 *         alertsViewed:
 *           type: integer
 *         teams:
 *           type: array
 *           items:
 *             $ref: "#/components/schemas/TeamRole"
 *         roles:
 *           type: object
 *         provider:
 *           type: string
 *         resetPasswordExpires:
 *           type: boolean
 *           default: null
 *         id:
 *           type: string
 *         preferences:
 *           type: object
 */
const UserSchema = new mongoose.Schema(
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
UserSchema.pre('save', function (next) {
	const user = /** @type {UserDocument} */ (/** @type {?} */ (this));

	// If the password is modified and it is valid, then re- salt/hash it
	if (
		user.isModified('password') &&
		validatePassword.call(user, user.password)
	) {
		user.salt = Buffer.from(
			crypto.randomBytes(16).toString('base64'),
			'base64'
		);
		user.password = user.hashPassword(user.password);
	}

	next();
});

/**
 * Instance Methods
 */

/**
 * Hash Password
 * @this import('./types').UserDocument
 * @param {string} password Password
 * @returns {string} An SHA1 hash of the password.
 */
UserSchema.methods.hashPassword = function (password) {
	const user = /** @type {UserDocument} */ (this);

	if (user.salt && password) {
		return crypto
			.pbkdf2Sync(password, user.salt, 10000, 64, 'SHA1')
			.toString('base64');
	} else {
		return password;
	}
};

/**
 * Authenticate a password against the user
 * @this import('./types').UserDocument
 * @param {string} password Password attempt.
 * @returns {boolean} Whether or not the password is correct.
 */
UserSchema.methods.authenticate = function (password) {
	const user = /** @type {UserDocument} */ (this);
	return user.password === user.hashPassword(password);
};

/**
 * Static Methods
 */

UserSchema.statics.hasRoles = function (user, roles) {
	if (null == user.roles) {
		return false;
	}
	let toReturn = true;

	if (null != roles) {
		roles.forEach((element) => {
			if (!user.roles[element]) {
				toReturn = false;
			}
		});
	}

	return toReturn;
};

// Filtered Copy of a User (public)
const filteredCopy = function (user) {
	/**
	 * @type {Object.<string, any>}
	 */
	let toReturn = null;

	if (null != user) {
		toReturn = {};

		toReturn._id = user._id;
		toReturn.name = user.name;
		toReturn.username = user.username;
		toReturn.organizationLevels = user.organizationLevels;
		toReturn.lastLogin = user.lastLogin;

		// The below fields (and other) are available, but shouldn't
		// necessarily be exposed to other users.

		// toReturn.created = user.created;
		// toReturn.lastLogin = user.lastLogin;
		// toReturn.messagesAcknowledged = user.messagesAcknowledged;
		// toReturn.alertsViewed = user.alertsViewed;
		// toReturn.newFeatureDismissed = user.newFeatureDismissed;

		if (null != user.providerData) {
			toReturn.providerData = {
				dn: user.providerData.dn
			};
		}

		if (null != user.preferences) {
			toReturn.preferences = user.preferences;
		}
	}

	return toReturn;
};

UserSchema.statics.filteredCopy = filteredCopy;

// Full Copy of a User (admin)
UserSchema.statics.fullCopy = function (user) {
	let toReturn = null;

	if (null != user) {
		toReturn = user.toObject();
		if (_.has(toReturn, 'password')) {
			delete toReturn.password;
		}
		if (_.has(toReturn, 'salt')) {
			delete toReturn.salt;
		}
	}

	return toReturn;
};

// Copy User for creation
UserSchema.statics.createCopy = function (user) {
	const toReturn = {};

	toReturn.name = user.name;
	toReturn.organization = user.organization;
	toReturn.organizationLevels = user.organizationLevels;
	toReturn.email = user.email;
	toReturn.phone = user.phone;
	toReturn.username = user.username;
	toReturn.password = user.password;
	toReturn.created = Date.now();
	toReturn.updated = toReturn.created;
	toReturn.messagesAcknowledged = user.messagesAcknowledged;
	toReturn.alertsViewed = user.alertsViewed;
	toReturn.newFeatureDismissed = user.newFeatureDismissed;

	if (null != user.preferences) {
		toReturn.preferences = user.preferences;
	}

	return toReturn;
};

// Copy a user for audit logging
UserSchema.statics.auditCopy = function (user, userIP) {
	const toReturn = {};
	user = user || {};

	toReturn._id = user._id;
	toReturn.name = user.name;
	toReturn.username = user.username;
	toReturn.organization = user.organization;
	toReturn.organizationLevels = user.organizationLevels;
	toReturn.email = user.email;
	toReturn.phone = user.phone;
	toReturn.messagesAcknowledged = user.messagesAcknowledged;
	toReturn.alertsViewed = user.alertsViewed;
	toReturn.newFeatureDismissed = user.newFeatureDismissed;
	toReturn.canProxy = user.canProxy;
	toReturn.canMasquerade = user.canMasquerade;
	if (null != userIP) {
		toReturn.ip = userIP;
	}
	toReturn.teams = _.cloneDeep(user.teams);

	toReturn.roles = _.cloneDeep(user.roles);
	toReturn.bypassAccessCheck = user.bypassAccessCheck;
	if (null != user.providerData && null != user.providerData.dn) {
		toReturn.dn = user.providerData.dn;
	}

	if (null != user.preferences) {
		toReturn.preferences = user.preferences;
	}

	return toReturn;
};

UserSchema.statics.roles = roles;

const User = mongoose.model('User', UserSchema);

/**
 * Model Registration
 */
module.exports = User;
