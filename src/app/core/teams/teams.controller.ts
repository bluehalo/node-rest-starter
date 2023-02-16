import { dbs, utilService, auditService } from '../../../dependencies';
import userService from '../user/user.service';
import { TeamRoles } from './team-role.model';
import teamsService from './teams.service';

const User = dbs.admin.model('User');

/**
 * Create a new team. The team creator is automatically added as an admin
 */
export const create = async (req, res) => {
	const result = await teamsService.create(
		req.body.team,
		req.user,
		req.body.firstAdmin
	);

	// Audit the creation action
	await auditService.audit(
		'team created',
		'team',
		'create',
		req,
		result.auditCopy()
	);

	res.status(200).json(result);
};

/**
 * Read the team
 */
export const read = (req, res) => {
	res.status(200).json(req.team);
};

/**
 * Update the team metadata
 */
export const update = async (req, res) => {
	// Make a copy of the original team for auditing purposes
	const originalTeam = req.team.auditCopy();

	const result = await teamsService.update(req.team, req.body);

	await auditService.audit('team updated', 'team', 'update', req, {
		before: originalTeam,
		after: result.auditCopy()
	});

	res.status(200).json(result);
};

/**
 * Delete the team
 */
export const deleteTeam = async (req, res) => {
	await teamsService.delete(req.team);

	// Audit the team delete attempt
	await auditService.audit(
		'team deleted',
		'team',
		'delete',
		req,
		req.team.auditCopy()
	);

	res.status(200).json(req.team);
};

/**
 * Search the teams, includes paging and sorting
 */
export const search = async (req, res) => {
	// Get search and query parameters
	const search = req.body.s ?? null;
	const query = utilService.toMongoose(req.body.q ?? {});

	const result = await teamsService.search(req.query, query, search, req.user);
	res.status(200).json(result);
};

export const getAncestorTeamIds = async (req, res) => {
	const result = await teamsService.getAncestorTeamIds(req.body.teamIds);
	res.status(200).json(result);
};

export const requestNewTeam = async (req, res) => {
	const user = req.user;
	const org = req.body.org ?? null;
	const aoi = req.body.aoi ?? null;
	const description = req.body.description ?? null;

	await teamsService.requestNewTeam(org, aoi, description, user, req);

	await auditService.audit('new team requested', 'team', 'request', req, {
		org,
		aoi,
		description
	});

	res.status(204).end();
};

export const requestAccess = async (req, res) => {
	await teamsService.requestAccessToTeam(req.user, req.team, req);
	res.status(204).end();
};

/**
 * Search the members of the team, includes paging and sorting
 */
export const searchMembers = async (req, res) => {
	// Get search and query parameters
	const search = req.body.s ?? '';
	const query = teamsService.updateMemberFilter(
		utilService.toMongoose(req.body.q ?? {}),
		req.team
	);

	const results = await userService.searchUsers(req.query, query, search);

	// Create the return copy of the messages
	const mappedResults = {
		pageNumber: results.pageNumber,
		pageSize: results.pageSize,
		totalPages: results.totalPages,
		totalSize: results.totalSize,
		elements: results.elements.map((element) => {
			return {
				...User.filteredCopy(element),
				teams: element.teams.filter((team) => team._id.equals(req.team._id))
			};
		})
	};

	res.status(200).json(mappedResults);
};

/**
 * Add a member to a team, defaulting to read-only access
 */
export const addMember = async (req, res) => {
	const role: TeamRoles = req.body.role ?? TeamRoles.Member;

	await teamsService.addMemberToTeam(req.userParam, req.team, role);

	// Audit the member add request
	await auditService.audit(
		`team ${role} added`,
		'team-role',
		'user add',
		req,
		req.team.auditCopyTeamMember(req.userParam, role)
	);

	res.status(204).end();
};

/**
 * Add specified members with specified roles to a team
 */
export const addMembers = async (req, res) => {
	await Promise.all(
		req.body.newMembers
			.filter((member) => null != member._id)
			.map(async (member) => {
				const user = await userService.read(member._id);
				if (null != user) {
					await teamsService.addMemberToTeam(user, req.team, member.role);
					return auditService.audit(
						`team ${member.role} added`,
						'team-role',
						'user add',
						req,
						req.team.auditCopyTeamMember(user, member.role)
					);
				}
			})
	);
	res.status(204).end();
};

/**
 * Remove a member from a team
 */
export const removeMember = async (req, res) => {
	await teamsService.removeMemberFromTeam(req.userParam, req.team);

	// Audit the user remove
	await auditService.audit(
		'team member removed',
		'team-role',
		'user remove',
		req,
		req.team.auditCopyTeamMember(req.userParam)
	);

	res.status(204).end();
};

export const updateMemberRole = async (req, res) => {
	const role: TeamRoles = req.body.role || TeamRoles.Member;

	await teamsService.updateMemberRole(req.userParam, req.team, role);

	// Audit the member update request
	await auditService.audit(
		`team role changed to ${role}`,
		'team-role',
		'user add',
		req,
		req.team.auditCopyTeamMember(req.userParam, role)
	);

	res.status(204).end();
};

/**
 * Team middleware
 */
export const teamById = async (req, res, next, id: string) => {
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

	const team = await teamsService.read(id, populate);
	if (!team) {
		return next(new Error('Could not find team'));
	}
	req.team = team;
	return next();
};

export const teamMemberById = async (req, res, next, id: string) => {
	const user = await userService.read(id);

	if (null == user) {
		return next(new Error('Failed to load team member'));
	}
	req.userParam = user;
	return next();
};

/**
 * Does the user have the referenced role in the team
 */
function requiresRole(role: TeamRoles): (req) => Promise<void> {
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
}

export const requiresAdmin = (req) => {
	return requiresRole(TeamRoles.Admin)(req);
};

export const requiresEditor = (req) => {
	return requiresRole(TeamRoles.Editor)(req);
};

export const requiresMember = (req) => {
	return requiresRole(TeamRoles.Member)(req);
};
