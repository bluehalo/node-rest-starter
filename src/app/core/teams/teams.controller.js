'use strict';

const
	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	util = deps.utilService,

	TeamMember = dbs.admin.model('TeamUser'),
	Team = dbs.admin.model('Team'),
	teamsService = require('./teams.service')();


/**
 * Create a new team. The team creator is automatically added as an admin
 */
module.exports.create = async (req, res) => {
	try {
		let result = await teamsService.createTeam(req.body.team, req.user, req.body.firstAdmin, req.headers);
		res.status(200).json(result);
	} catch(err) {
		util.handleErrorResponse(res, err);
	}
};

/**
 * Get all the teams in the system
 */
module.exports.get = async (req, res) => {
	try {
		let result = await teamsService.getTeams(req.query);
		res.status(200).json(result);
	} catch(err) {
		util.handleErrorResponse(res, err);
	}
};

/**
 * Read the team
 */
module.exports.read = (req, res) => {
	res.status(200).json(req.team);
};

/**
 * Update the team metadata
 */
module.exports.update = async (req, res) => {
	try {
		let result = await teamsService.updateTeam(req.team, req.body, req.user, req.headers);
		res.status(200).json(result);
	} catch(err) {
		util.handleErrorResponse(res, err);
	}
};

/**
 * Delete the team
 */
module.exports.delete = async (req, res) => {
	try {
		await teamsService.deleteTeam(req.team, req.user, req.headers);
		res.status(200).json(req.team);
	} catch (err) {
		util.handleErrorResponse(res, err);
	}
};


/**
 * Search the teams, includes paging and sorting
 */
module.exports.search = async (req, res) => {
	// Get search and query parameters
	const search = req.body.s || null;
	let query = req.body.q || {};
	query = util.toMongoose(query);

	try {
		let result = await teamsService.searchTeams(search, query, req.query, req.user);
		res.status(200).json(result);
	} catch (err) {
		util.handleErrorResponse(res, err);
	}
};

module.exports.requestNewTeam = async (req, res) => {
	const user = req.user;
	const org = req.body.org || null;
	const aoi = req.body.aoi || null;
	const description = req.body.description || null;

	try {
		await teamsService.requestNewTeam(org, aoi, description, user, req);
		res.status(204).end();
	} catch (err) {
		util.handleErrorResponse(res, err);
	}
};

module.exports.requestAccess = async (req, res) => {
	const user = req.user;
	const team = req.team || null;

	try {
		await teamsService.requestAccessToTeam(user, team, req);
		res.status(204).end();
	} catch (err) {
		util.handleErrorResponse(res, err);
	}
};

/**
 * Search the members of the team, includes paging and sorting
 */
module.exports.searchMembers = async (req, res) => {
	// Get search and query parameters
	const search = req.body.s || null;
	let query = req.body.q || {};
	query = util.toMongoose(query);

	try {
		let result = await teamsService.searchTeamMembers(search, query, req.query, req.team);
		res.status(200).json(result);
	} catch(err) {
		util.handleErrorResponse(res, err);
	}
};


/**
 * Add a member to a team, defaulting to read-only access
 */
module.exports.addMember = async (req, res) => {
	const user = req.userParam;
	const team = req.team;
	const role = req.body.role || 'member';

	try {
		await teamsService.addMemberToTeam(user, team, role, req.user, req.headers);
	} catch(err) {
		util.handleErrorResponse(res, err);
	}
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
module.exports.removeMember = async (req, res) => {
	const user = req.userParam;
	const team = req.team;

	try {
		await teamsService.removeMemberFromTeam(user, team, req.user, req.headers);
		res.status(204).end();
	} catch(err) {
		util.handleErrorResponse(res, err);
	}
};

module.exports.updateMemberRole = async (req, res) => {
	const user = req.userParam;
	const team = req.team;
	const role = req.body.role || 'member';

	try {
		await teamsService.updateMemberRole(user, team, role, req.user, req.headers);
		res.status(204).end();
	} catch(err) {
		util.handleErrorResponse(res, err);
	}
};

/**
 * Team middleware
 */
module.exports.teamById = async (req, res, next, id) => {
	let team = await Team.findOne({ _id: id }).exec();

	if (null == team) {
		next(new Error('Could not find team: ' + id));
	} else {
		req.team = team;
		next();
	}
};

module.exports.teamUserById = async (req, res, next, id) => {
	let user = await TeamMember.findOne({ _id: id }).exec();

	if (null == user) {
		next(new Error(`Failed to load team member ${id}`));
	} else {
		req.userParam = user;
		next();
	}
};

/**
 * Does the user have the referenced role in the team
 */
module.exports.requiresRole = function(role) {
	return function(req) {

		// Verify that the user and team are on the request
		let user = req.user;
		if (null == user) {
			return Promise.reject({ status: 400, type: 'bad-request', message: 'No user for request' });
		}
		let team = req.team;
		if (null == team) {
			return Promise.reject({ status: 400, type: 'bad-request', message: 'No team for request' });
		}

		return teamsService.meetsRoleRequirement(user, team, role);
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
