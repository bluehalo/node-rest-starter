'use strict';

const
	_ = require('lodash'),
	mongoose = require('mongoose'),

	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	util = deps.utilService,
	query = deps.queryService,
	GetterSchema = deps.schemaService.GetterSchema,

	UserModel = require('../user/user.model'),
	UserSchema = UserModel.schema;


/**
 * Team Schema
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Team:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         role:
 *           type: string
 */
const TeamRoleSchema = new GetterSchema({
	_id: {
		type: mongoose.Schema.ObjectId,
		ref: 'Team'
	},
	role: {
		type: String,
		trim: true,
		default: 'member',
		enum: [ 'admin', 'editor', 'member', 'requester' ]
	}
});

UserSchema.add({
	teams: {
		type: [ TeamRoleSchema ],
		default: []
	}
});

const TeamSchema = new GetterSchema({
	name: {
		type: String,
		trim: true,
		default: '',
		validate: [ util.validateNonEmpty, 'Please provide a team name' ]
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
		type: mongoose.Schema.ObjectId,
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
		type: [],
		default: []
	},
	requiresExternalTeams: {
		type: [],
		default: []
	}
});


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


// Search teams by text and other criteria
TeamSchema.statics.search = function(queryTerms, searchTerms, limit, offset, sortArr) {
	return query.search(this, queryTerms, searchTerms, limit, offset, sortArr);
};

// Copy Team for creation
TeamSchema.statics.createCopy = function(team) {
	const toReturn = {};

	toReturn.name = team.name;
	toReturn.description = team.description;
	toReturn.created = team.created;

	return toReturn;
};

// Copy a team for audit logging
TeamSchema.statics.auditCopy = function(team) {
	const toReturn = {};
	team = team || {};

	toReturn._id = team._id;
	toReturn.name = team.name;
	toReturn.description = team.description;

	return toReturn;
};

// Copy a team role for audit logging
TeamSchema.statics.auditCopyTeamMember = function(team, user, role) {
	const toReturn = {};
	user = user || {};
	team = team || {};

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
UserSchema.statics.auditCopy = (user) => {

	user = user || {};
	const toReturn = userAuditCopy(user);
	const userObj = user.toObject();

	const teams = userObj.teams || [];

	return Promise.all(teams.filter((team) => team.role !== 'requester').map((team) => dbs.admin.model('Team').findOne({_id: team._id}).exec().then((t) => _.get(t, 'name', null)))).then((teamNames) => {
		toReturn.teams = teamNames.filter((name) => null != name);
		return toReturn;
	}, () => {
		return toReturn;
	});
};

// Team Copy of a User (has team roles for the team )
UserSchema.statics.teamCopy = function(user, teamId) {
	let toReturn = null;

	if(null != user){
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
