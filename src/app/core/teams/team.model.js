'use strict';

const _ = require('lodash'),
	mongoose = require('mongoose'),
	getterPlugin = require('../../common/mongoose/getter.plugin'),
	pagingSearchPlugin = require('../../common/mongoose/paging-search.plugin'),
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
		enum: ['admin', 'editor', 'member', 'requester']
	}
});
TeamRoleSchema.plugin(getterPlugin);

UserSchema.add({
	teams: {
		type: [TeamRoleSchema]
	}
});

const TeamSchema = new mongoose.Schema({
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
	created: {
		type: Date,
		default: Date.now,
		get: util.dateParse
	},
	creator: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	},
	creatorName: {
		type: String
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
});
TeamSchema.plugin(getterPlugin);
TeamSchema.plugin(pagingSearchPlugin);

/**
 * Index declarations
 */

// Text-search index
TeamSchema.index({ name: 'text', description: 'text' });

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
					.then((t) => _.get(t, 'name', null))
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
	let toReturn = null;

	if (null != user) {
		toReturn = user.toObject();

		toReturn.teams = user.teams;
	}

	return toReturn;
};

/**
 * Model Registration
 */
mongoose.model('TeamRole', TeamRoleSchema);
mongoose.model('TeamUser', UserSchema, 'users');
