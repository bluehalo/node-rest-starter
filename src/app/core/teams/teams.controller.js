'use strict';

const deps = require('../../../dependencies'),
	dbs = deps.dbs,
	util = deps.utilService,
	auditService = deps.auditService,
	TeamMember = dbs.admin.model('TeamUser'),
	Team = dbs.admin.model('Team'),
	teamsService = require('./teams.service');

/**
 * Create a new team. The team creator is automatically added as an admin
 */
module.exports.create = async (req, res) => {
	try {
		const result = await teamsService.createTeam(
			req.body.team,
			req.user,
			req.body.firstAdmin
		);

		// Audit the creation action
		await auditService.audit(
			'team created',
			'team',
			'create',
			TeamMember.auditCopy(
				req.user,
				util.getHeaderField(req.headers, 'x-real-ip')
			),
			Team.auditCopy(result),
			req.headers
		);

		res.status(200).json(result);
	} catch (err) {
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
	if (null == req.team) {
		return util.handleErrorResponse(res, {
			status: 400,
			type: 'error',
			message: 'Could not find team'
		});
	}

	try {
		// Make a copy of the original team for auditing purposes
		const originalTeam = Team.auditCopy(req.team);

		const result = await teamsService.updateTeam(req.team, req.body);

		await auditService.audit(
			'team updated',
			'team',
			'update',
			TeamMember.auditCopy(
				req.user,
				util.getHeaderField(req.headers, 'x-real-ip')
			),
			{
				before: originalTeam,
				after: Team.auditCopy(result)
			},
			req.headers
		);

		res.status(200).json(result);
	} catch (err) {
		util.handleErrorResponse(res, err);
	}
};

/**
 * Delete the team
 */
module.exports.delete = async (req, res) => {
	if (null == req.team) {
		return util.handleErrorResponse(res, {
			status: 400,
			type: 'error',
			message: 'Could not find team'
		});
	}

	try {
		await teamsService.deleteTeam(req.team);

		// Audit the team delete attempt
		await auditService.audit(
			'team deleted',
			'team',
			'delete',
			TeamMember.auditCopy(
				req.user,
				util.getHeaderField(req.headers, 'x-real-ip')
			),
			Team.auditCopy(req.team),
			req.headers
		);

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
		const result = await teamsService.searchTeams(
			req.query,
			query,
			search,
			req.user
		);
		res.status(200).json(result);
	} catch (err) {
		util.handleErrorResponse(res, err);
	}
};

module.exports.getAncestorTeamIds = async (req, res) => {
	try {
		const result = await teamsService.getAncestorTeamIds(req.body.teamIds);
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

		await auditService.audit(
			'new team requested',
			'team',
			'request',
			TeamMember.auditCopy(req.user),
			{
				org,
				aoi,
				description
			},
			req.headers
		);

		res.status(204).end();
	} catch (err) {
		util.handleErrorResponse(res, err);
	}
};

module.exports.requestAccess = async (req, res) => {
	if (null == req.team) {
		return util.handleErrorResponse(res, {
			status: 400,
			type: 'error',
			message: 'Could not find team'
		});
	}

	try {
		await teamsService.requestAccessToTeam(req.user, req.team, req);
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
		const result = await teamsService.searchTeamMembers(
			search,
			query,
			req.query,
			req.team
		);
		res.status(200).json(result);
	} catch (err) {
		util.handleErrorResponse(res, err);
	}
};

/**
 * Add a member to a team, defaulting to read-only access
 */
module.exports.addMember = async (req, res) => {
	if (null == req.team) {
		return util.handleErrorResponse(res, {
			status: 400,
			type: 'error',
			message: 'Could not find team'
		});
	}

	const role = req.body.role || 'member';

	try {
		await teamsService.addMemberToTeam(req.userParam, req.team, role);

		// Audit the member add request
		await auditService.audit(
			`team ${role} added`,
			'team-role',
			'user add',
			TeamMember.auditCopy(req.user),
			Team.auditCopyTeamMember(req.team, req.userParam, role),
			req.headers
		);

		res.status(204).end();
	} catch (err) {
		util.handleErrorResponse(res, err);
	}
};

/**
 * Add specified members with specified roles to a team
 */
module.exports.addMembers = async (req, res) => {
	if (null == req.team) {
		return util.handleErrorResponse(res, {
			status: 400,
			type: 'error',
			message: 'Could not find team'
		});
	}

	if (null == req.body.newMembers || req.body.newMembers.length === 0) {
		return util.handleErrorResponse(res, {
			status: 400,
			type: 'error',
			message: 'New team members not specified'
		});
	}

	try {
		await Promise.all(
			req.body.newMembers
				.filter((member) => null != member._id)
				.map(async (member) => {
					const user = await teamsService.readTeamMember(member._id);
					if (null != user) {
						await teamsService.addMemberToTeam(user, req.team, member.role);
						return auditService.audit(
							`team ${member.role} added`,
							'team-role',
							'user add',
							TeamMember.auditCopy(req.user),
							Team.auditCopyTeamMember(req.team, req.userParam, member.role),
							req.headers
						);
					}
				})
		);
		res.status(204).end();
	} catch (err) {
		util.handleErrorResponse(res, err);
	}
};

/**
 * Remove a member from a team
 */
module.exports.removeMember = async (req, res) => {
	if (null == req.team) {
		return util.handleErrorResponse(res, {
			status: 400,
			type: 'error',
			message: 'Could not find team'
		});
	}

	try {
		await teamsService.removeMemberFromTeam(req.userParam, req.team);

		// Audit the user remove
		await auditService.audit(
			'team member removed',
			'team-role',
			'user remove',
			TeamMember.auditCopy(req.user),
			Team.auditCopyTeamMember(req.team, req.userParam),
			req.headers
		);

		res.status(204).end();
	} catch (err) {
		util.handleErrorResponse(res, err);
	}
};

module.exports.updateMemberRole = async (req, res) => {
	if (null == req.team) {
		return util.handleErrorResponse(res, {
			status: 400,
			type: 'error',
			message: 'Could not find team'
		});
	}

	const role = req.body.role || 'member';

	try {
		await teamsService.updateMemberRole(req.userParam, req.team, role);

		// Audit the member update request
		await auditService.audit(
			`team role changed to ${role}`,
			'team-role',
			'user add',
			TeamMember.auditCopy(req.user),
			Team.auditCopyTeamMember(req.team, req.userParam, role),
			req.headers
		);

		res.status(204).end();
	} catch (err) {
		util.handleErrorResponse(res, err);
	}
};

/**
 * Team middleware
 */
module.exports.teamById = async (req, res, next, id) => {
	const populate = [
		{
			path: 'parent',
			select: ['name']
		},
		{
			path: 'ancestors',
			select: ['name']
		}
	];

	const team = await teamsService.readTeam(id, populate);

	if (null == team) {
		return next(new Error('Could not find team'));
	}
	req.team = team;
	return next();
};

module.exports.teamMemberById = async (req, res, next, id) => {
	const user = await teamsService.readTeamMember(id);

	if (null == user) {
		return next(new Error('Failed to load team member'));
	}
	req.userParam = user;
	return next();
};

/**
 * Does the user have the referenced role in the team
 */
module.exports.requiresRole = function (role) {
	return function (req) {
		// Verify that the user and team are on the request
		const user = req.user;
		if (null == user) {
			return Promise.reject({
				status: 400,
				type: 'bad-request',
				message: 'No user for request'
			});
		}
		const team = req.team;
		if (null == team) {
			return Promise.reject({
				status: 400,
				type: 'bad-request',
				message: 'No team for request'
			});
		}

		return teamsService.meetsRoleRequirement(user, team, role);
	};
};

exports.requiresAdmin = function (req) {
	return module.exports.requiresRole('admin')(req);
};

exports.requiresEditor = function (req) {
	return module.exports.requiresRole('editor')(req);
};

exports.requiresMember = function (req) {
	return module.exports.requiresRole('member')(req);
};
