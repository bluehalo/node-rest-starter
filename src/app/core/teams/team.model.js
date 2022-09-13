'use strict';

const mongoose = require('mongoose'),
	getterPlugin = require('../../common/mongoose/getter.plugin'),
	paginatePlugin = require('../../common/mongoose/paginate.plugin'),
	containsSearchPlugin = require('../../common/mongoose/contains-search.plugin'),
	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	util = deps.utilService,
	UserModel = require('../user/user.model'),
	UserSchema = UserModel.schema;

/**
 * Team Schema
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     TeamRole:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         role:
 *           type: string
 */
const TeamRoleSchema = new mongoose.Schema({
	_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Team'
	},
	role: {
		type: String,
		trim: true,
		default: 'member',
		enum: ['admin', 'editor', 'member', 'requester', 'blocked']
	}
});
TeamRoleSchema.plugin(getterPlugin);

UserSchema.add({
	// @ts-ignore: Proper fix for this is probably to merge these changes to the User Schema/Model to user.model.js vs. modifying them here
	teams: {
		type: [TeamRoleSchema]
	}
});

const TeamSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			trim: true,
			default: '',
			validate: [util.validateNonEmpty, 'Please provide a team name']
		},
		description: {
			type: String,
			trim: true
		},
		creator: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			immutable: true
		},
		creatorName: {
			type: String,
			immutable: true
		},
		implicitMembers: {
			type: Boolean,
			default: false
		},
		requiresExternalRoles: {
			type: [String]
		},
		requiresExternalTeams: {
			type: [String]
		},
		parent: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Team'
		},
		ancestors: {
			type: [
				{
					type: mongoose.Schema.Types.ObjectId,
					ref: 'Team'
				}
			]
		}
	},
	{
		timestamps: {
			createdAt: 'created',
			updatedAt: 'updated'
		}
	}
);
TeamSchema.plugin(getterPlugin);
TeamSchema.plugin(paginatePlugin);
TeamSchema.plugin(containsSearchPlugin, {
	fields: ['name', 'description']
});

/**
 * Index declarations
 */
TeamSchema.index({ name: 1 });
TeamSchema.index({ description: 1 });
TeamSchema.index({ created: 1 });

/**
 * Lifecycle Hooks
 */

/**
 * Instance Methods
 */

/**
 * Static Methods
 */
// Copy a team for audit logging
TeamSchema.statics.auditCopy = function (team = {}) {
	const toReturn = {};

	toReturn._id = team._id;
	toReturn.name = team.name;
	toReturn.description = team.description;

	return toReturn;
};

// Copy a team role for audit logging
TeamSchema.statics.auditCopyTeamMember = function (
	team = {},
	user = {},
	role = null
) {
	const toReturn = {};

	toReturn.user = {
		_id: user._id,
		name: user.name,
		username: user.username
	};

	toReturn.team = {
		_id: team._id,
		name: team.name
	};

	toReturn.role = role;

	return toReturn;
};

mongoose.model('Team', TeamSchema, 'teams');

// Team Copy of a User ( has team roles for the team )
// @ts-ignore: Proper fix for this is probably to merge these changes to the User Schema/Model to user.model.js vs. modifying them here
const userAuditCopy = UserModel.auditCopy;
UserSchema.statics.auditCopy = (user = {}) => {
	/**
	 * @type {*}
	 */
	const toReturn = userAuditCopy(user);

	if (user.constructor.name === 'model') {
		user = user.toObject();
	}

	const teams = user.teams || [];

	return Promise.all(
		teams
			.filter((team) => team.role !== 'requester')
			.map((team) =>
				dbs.admin
					.model('Team')
					.findOne({ _id: team._id })
					.exec()
					.then((t) => t?.name ?? null)
			)
	).then(
		(teamNames) => {
			toReturn.teams = teamNames.filter((name) => null != name);
			return toReturn;
		},
		() => {
			return toReturn;
		}
	);
};

// Team Copy of a User (has team roles for the team )
UserSchema.statics.teamCopy = function (user, teamId) {
	if (user == null) {
		return null;
	}

	// By using the filtered copy of a user, we ensure that we're not
	// returning any sensitive values that other users should not see.
	const toReturn = dbs.admin.model('User').filteredCopy(user);
	toReturn.teams = user.teams;
	return toReturn;
};

/**
 * Model Registration
 */
mongoose.model('TeamRole', TeamRoleSchema);
mongoose.model('TeamUser', UserSchema, 'users');
