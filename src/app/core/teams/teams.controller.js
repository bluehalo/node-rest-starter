'use strict';

const
	q = require('q'),
	_ = require('lodash'),

	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	util = deps.utilService,

	TeamMember = dbs.admin.model('TeamUser'),
	Team = dbs.admin.model('Team'),
	teamsService = require('./teams.service')();


/**
 * Create a new team. The team creator is automatically added as an admin
 */
module.exports.create = function(req, res) {
	teamsService.createTeam(req.body, req.user, req.headers).then((result) => {
		res.status(200).json(result);
	}, (err) => {
		util.handleErrorResponse(res, err);
	}).done();
};

/**
 * Get all the teams in the system
 */
module.exports.get = function(req, res) {
	teamsService.getTeams(req.query).then((result) => {
		res.status(200).json(result);
	}, (err) => {
		util.handleErrorResponse(res, err);
	}).done();
};

/**
 * Read the team
 */
module.exports.read = function(req, res) {
	res.status(200).json(req.team);
};


/**
 * Update the team metadata
 */
module.exports.update = function(req, res) {
	teamsService.updateTeam(req.team, req.body, req.user, req.headers).then((result) => {
		res.status(200).json(result);
	}, (err) => {
		util.handleErrorResponse(res, err);
	}).done();
};


/**
 * Delete the team
 */
module.exports.delete = function(req, res) {
	teamsService.deleteTeam(req.team, req.user, req.headers).then(() => {
		res.status(200).json(req.team);
	}, (err) => {
		util.handleErrorResponse(res, err);
	}).done();
};


/**
 * Search the teams, includes paging and sorting
 */
module.exports.search = function(req, res) {
	// Get search and query parameters
	const search = req.body.s || null;
	let query = req.body.q || {};
	query = util.toMongoose(query);

	teamsService.searchTeams(search, query, req.query, req.user).then((result) => {
		res.status(200).json(result);
	}, (err) => {
		util.handleErrorResponse(res, err);
	}).done();
};

module.exports.requestNewTeam = function(req, res) {
	const user = req.user;
	const org = req.body.org || null;
	const aoi = req.body.aoi || null;
	const description = req.body.description || null;

	teamsService.requestNewTeam(org, aoi, description, user, req.headers).then(() => {
		res.status(204).end();
	}, (err) => {
		util.handleErrorResponse(res, err);
	}).done();
};

module.exports.requestAccess = function(req, res) {
	const user = req.user;
	const team = req.team || null;

	teamsService.requestAccessToTeam(user, team, req.headers).then(() => {
		res.status(204).end();
	}, (err) => {
		util.handleErrorResponse(res, err);
	}).done();
};

/**
 * Search the members of the team, includes paging and sorting
 */
module.exports.searchMembers = function(req, res) {
	// Get search and query parameters
	const search = req.body.s || null;
	let query = req.body.q || {};
	query = util.toMongoose(query);

	teamsService.searchTeamMembers(search, query, req.query, req.team).then((result) => {
		res.status(200).json(result);
	}, (err) => {
		util.handleErrorResponse(res, err);
	}).done();
};


/**
 * Add a member to a team, defaulting to read-only access
 */
module.exports.addMember = function(req, res) {
	const user = req.userParam;
	const team = req.team;
	const role = req.body.role || 'member';

	teamsService.addMemberToTeam(user, team, role, req.user, req.headers).then(() => {
		res.status(204).end();
	}, (err) => {
		util.handleErrorResponse(res, err);
	}).done();
};

/**
 * Add specified members with specified roles to a team
 */
module.exports.addMembers = async (req, res) => {
	const newMembers = req.body.newMembers || [];
	const team = req.team;

	try {
		await teamsService.addMembersToTeam(newMembers, team, req.user, req.headers);
		res.status(204).end();
	} catch (err) {
		util.handleErrorResponse(res, err);
	}
};

/**
 * Remove a member from a team
 */
module.exports.removeMember = function(req, res) {
	const user = req.userParam;
	const team = req.team;

	teamsService.removeMemberFromTeam(user, team, req.user, req.headers).then(() => {
		res.status(204).end();
	}, (err) => {
		util.handleErrorResponse(res, err);
	}).done();
};


module.exports.updateMemberRole = function(req, res) {
	const user = req.userParam;
	const team = req.team;
	const role = req.body.role || 'member';

	teamsService.updateMemberRole(user, team, role, req.user, req.headers).then(() => {
		res.status(204).end();
	}, (err) => {
		util.handleErrorResponse(res, err);
	}).done();
};


/**
 * Team middleware
 */
module.exports.teamById = function(req, res, next, id) {
	Team.findOne({ _id: id }).exec().then((team) => {
		if (null == team) {
			next(new Error('Could not find team: ' + id));
		}
		else {
			req.team = team;
			next();
		}
	}, next);
};


module.exports.teamUserById = function(req, res, next, id) {
	TeamMember.findOne({ _id: id }).exec().then((user) => {
		if (null == user) {
			next(new Error(`Failed to load team member ${id}`));
		}
		else {
			req.userParam = user;
			next();
		}
	}, next);
};


/**
 * Team authorization Middleware
 */

module.exports.getTeamIds = function(user, role) {
	// Validate the user input
	if(null == user) {
		return q.reject({ status: 401, type: 'bad-request', message: 'User does not exist' });
	}

	if (user.constructor.name === 'model') {
		user = user.toObject();
	}

	let userTeams = (_.isArray(user.teams)) ? user.teams : [];
	let filteredTeamIds = userTeams.filter((t) => (null != t.role && t.role === role)).map((t) => t._id.toString());

	return q(filteredTeamIds);
};

module.exports.getMemberTeamIds = function(user) {
	return q.all([module.exports.getTeamIds(user, 'member'), module.exports.getTeamIds(user, 'editor'), module.exports.getTeamIds(user, 'admin')])
		.then(function(teamIds) {
			return _.union(teamIds[0], teamIds[1], teamIds[2]);
		});
};

module.exports.getEditorTeamIds = function(user) {
	return q.all([module.exports.getTeamIds(user, 'editor'), module.exports.getTeamIds(user, 'admin')])
		.then(function(teamIds) {
			return _.union(teamIds[0], teamIds[1]);
		});
};

module.exports.getAdminTeamIds = function(user) {
	return module.exports.getTeamIds(user, 'admin');
};

// Constrain a set of teamIds provided by the user to those the user actually has access to.
module.exports.filterTeamIds = function(user, teamIds) {
	return exports.getMemberTeamIds(user)
		.then(function(memberTeamIds) {
			// If there were no teamIds to filter by, return all the team ids
			if(null == teamIds || (_.isArray(teamIds) && teamIds.length === 0)) {
				return q(memberTeamIds);
			}
			// Else, return the intersection of the two
			else {
				return q(_.intersection(memberTeamIds, teamIds));
			}
		});
};

module.exports.meetsRoleRequirement = function(user, team, role, rejectStatus) {
	// Check role of the user in this team
	let userRole = teamsService.getActiveTeamRole(user, team);
	if (null != userRole && teamsService.meetsOrExceedsRole(userRole, role)) {
		return q();
	}
	else {
		rejectStatus = rejectStatus || { status: 403, type: 'missing-roles', message: 'The user does not have the required roles for the team' };
		return q.reject(rejectStatus);
	}
};

/**
 * Does the user have the referenced role in the team
 */
module.exports.requiresRole = function(role) {
	return function(req) {

		// Verify that the user and team are on the request
		let user = req.user.toObject();
		if(null == user) {
			return q.reject({ status: 400, type: 'bad-request', message: 'No user for request' });
		}
		let team = req.team;
		if(null == team) {
			return q.reject({ status: 400, type: 'bad-request', message: 'No team for request' });
		}

		return module.exports.meetsRoleRequirement(user, team, role);
	};
};

exports.requiresAdmin = function(req) {
	return module.exports.requiresRole('admin')(req);
};

exports.requiresEditor = function(req) {
	return module.exports.requiresRole('editor')(req);
};

exports.requiresMember = function(req) {
	return module.exports.requiresRole('member')(req);
};
