'use strict';

const
	_ = require('lodash'),
	mongoose = require('mongoose'),

	userAuthService = require('../user/auth/user-authorization.service'),
	deps = require('../../../dependencies'),
	config = deps.config,
	dbs = deps.dbs,
	logger = deps.logger,
	auditService = deps.auditService,
	emailService = deps.emailService,
	util = deps.utilService,

	Resource = dbs.admin.model('Resource'),
	TeamMember = dbs.admin.model('TeamUser'),
	Team = dbs.admin.model('Team'),
	TeamRole = dbs.admin.model('TeamRole'),
	User = dbs.admin.model('User');

module.exports = function() {

	let teamRolesMap = {
		requester: { priority: 0 },
		member: { priority: 1 },
		editor: { priority: 5 },
		admin: { priority: 7 }
	};

	// Array of team role keys
	let teamRoles = _.keys(teamRolesMap);

	/**
	 * Copies the mutable fields from src to dest
	 *
	 * @param dest
	 * @param src
	 */
	function copyMutableFields(dest, src) {
		dest.name = src.name;
		dest.description = src.description;
		dest.implicitMembers = src.implicitMembers;
		dest.requiresExternalRoles = src.requiresExternalRoles;
		dest.requiresExternalTeams = src.requiresExternalTeams;
	}

	/**
	 * Gets the role of this user in this team.
	 *
	 * @param team The team object of interest
	 * @param user The user object of interest
	 * @returns Returns the role of the user in the team or null if user doesn't belong to team.
	 */
	function getTeamRole(user, team) {
		let ndx = _.findIndex(user.teams, (t) => t._id.equals(team._id));

		if (-1 !== ndx) {
			return user.teams[ndx].role;
		}

		return null;
	}

	/**
	 * Checks if the user meets the required external teams for this team
	 * If the user is bypassed, they automatically meet the required external teams
	 *
	 * @param user
	 * @param team
	 * @returns {boolean}
	 */
	function isImplicitMember(user, team) {
		const strategy = _.get(config, 'teams.implicitMembers.strategy', null);

		if (strategy === 'roles') {
			return meetsRequiredExternalRoles(user, team);
		} else if (strategy === 'teams') {
			return meetsRequiredExternalTeams(user, team);
		}
		return false;
	}

	/**
	 * Checks if the user meets the required external teams for this team.
	 * Requires matching only one external team.
	 * If the user is bypassed, they automatically meet the required external teams
	 *
	 * @param user
	 * @param team
	 * @returns {boolean}
	 */
	function meetsRequiredExternalTeams(user, team) {
		if (true === user.bypassAccessCheck) {
			return true;
		} else {
			// Check the required external teams against the user's externalGroups
			return _.intersection(team.requiresExternalTeams, user.externalGroups).length > 0;
		}
	}

	/**
	 * Checks if the user meets the required external roles for this team.
	 * Requires matching all external roles.
	 *
	 * @param user
	 * @param team
	 * @returns {boolean}
	 */
	function meetsRequiredExternalRoles(user, team) {
		if (team.requiresExternalRoles == null || team.requiresExternalRoles.length === 0) {
			return false;
		}
		// Check the required external roles against the user's externalRoles
		return _.intersection(team.requiresExternalRoles, user.externalRoles).length === team.requiresExternalRoles.length;
	}

	function meetsRoleRequirement(user, team, role) {
		// Check role of the user in this team
		let userRole = getActiveTeamRole(user, team);

		if (null != userRole && meetsOrExceedsRole(userRole, role)) {
			return Promise.resolve();
		}

		return Promise.reject({ status: 403, type: 'missing-roles', message: 'The user does not have the required roles for the team' });
	}

	/**
	 * Checks if user role meets or exceeds the requestedRole according to
	 * a pre-defined role hierarchy
	 *
	 * @returns {boolean}
	 */
	function meetsOrExceedsRole(userRole, requestedRole) {
		if (null != userRole && _.has(teamRolesMap, userRole) && null != requestedRole && _.has(teamRolesMap, requestedRole)) {
			return (teamRolesMap[userRole].priority >= teamRolesMap[requestedRole].priority);
		}
		return false;
	}

	/**
	 * Gets the team role for the specified user
	 * and also applies the business logic of if they are implicitly a member
	 * of the team or if they are an inactive explicit member of a team
	 *
	 * @returns Returns a role, or null if the user is not a member of the team
	 */
	function getActiveTeamRole(user, team) {
		if (user.constructor.name === 'model') {
			user = user.toObject();
		}

		// No matter what, we need to get these
		let teamRole = getTeamRole(user, team);

		const implicitMembersEnabled = _.get(config, 'teams.implicitMembers.strategy', null) !== null;

		if (implicitMembersEnabled && team.implicitMembers) {
			// If the user is active
			if (isImplicitMember(user, team)) {
				// Return either the team role (if defined), or the default role
				return (null != teamRole) ? teamRole : 'member';
			}
			// The user is inactive
			else {
				// Return null since no matter what, they are not a member of this team
				return null;
			}
		}
		// We are not in proxy-pki mode, or the team has no requirements
		else {
			// Return the team role
			return teamRole;
		}
	}

	/**
	 * Checks if there are resources that belong to the team
	 *
	 * @param team The team object of interest
	 * @returns A promise that resolves if there are no more resources in the team, and rejects otherwise
	 */
	async function verifyNoResourcesInTeam(team) {
		let resources = await Resource.find({ 'owner.type': 'team', 'owner._id': team._id } ).exec();

		if (null != resources && resources.length > 0) {
			return Promise.reject({ status: 400, type: 'bad-request', message: 'There are still resources in this group.'});
		}

		return Promise.resolve();
	}

	/**
	 * Checks if the member is the last admin of the team
	 *
	 * @param user The user object of interest
	 * @param team The team object of interest
	 * @returns {Promise} Returns a promise that resolves if the user is not the last admin, and rejects otherwise
	 */
	async function verifyNotLastAdmin(user, team) {
		// Search for all users who have the admin role set to true
		let results = await TeamMember.find({
			_id: { $ne: user._id },
			teams: { $elemMatch: { _id: team._id, role: 'admin' } }
		}).exec();

		// Just need to make sure we find one active admin who isn't this user
		let adminFound = results.some((u) => {
			let role = getActiveTeamRole(u, team);
			return (null != role && role === 'admin');
		});

		if (adminFound) {
			return Promise.resolve();
		}
		return Promise.reject({ status: 400, type: 'bad-request', message: 'Team must have at least one admin' });
	}

	/**
	 * Validates that the roles are one of the accepted values
	 */
	async function validateTeamRole(role) {
		if (-1 !== teamRoles.indexOf(role)) {
			return Promise.resolve();
		}

		return Promise.reject({ status: 400, type: 'bad-argument', message: 'Team role does not exist' });
	}

	/**
	 * Creates a new team with the requested metadata
	 *
	 * @param teamInfo
	 * @param creator The user requesting the create
	 * @returns {Promise} Returns a promise that resolves if team is successfully created, and rejects otherwise
	 */
	async function createTeam(teamInfo, creator, firstAdmin, headers) {
		// Create the new team model
		let newTeam = new Team();

		copyMutableFields(newTeam, teamInfo);

		// Write the auto-generated metadata
		newTeam.creator = creator;
		newTeam.created = Date.now();
		newTeam.updated = Date.now();
		newTeam.creatorName = creator.name;

		let user = await User.findById(firstAdmin).exec();
		user = User.filteredCopy(user);

		// Audit the creation action
		await auditService.audit('team created', 'team', 'create', TeamMember.auditCopy(creator), Team.auditCopy(newTeam), headers);

		// Save the new team
		await newTeam.save();

		// Add first admin as first team member with admin role, or the creator if null
		return addMemberToTeam(user || creator, newTeam, 'admin', creator);
	}

	async function getTeams(queryParams) {
		const page = util.getPage(queryParams);
		const limit = util.getLimit(queryParams, 1000);

		const offset = page * limit;

		// Default to sorting by ID
		let sortArr = [{property: '_id', direction: 'DESC'}];
		if (null != queryParams.sort && null != queryParams.dir) {
			sortArr = [{property: queryParams.sort, direction: queryParams.dir}];
		}

		// Query for Teams
		const teams = await Team.search({}, null, limit, offset, sortArr);

		return {
			totalSize: teams.count,
			pageNumber: page,
			pageSize: limit,
			totalPages: Math.ceil(teams.count / limit),
			elements: teams.results
		};
	}

	/**
	 * Updates an existing team with fresh metadata
	 *
	 * @param team The team object to update
	 * @param updatedTeam
	 * @param user The user requesting the update
	 * @returns {Promise} Returns a promise that resolves if team is successfully updated, and rejects otherwise
	 */
	async function updateTeam(team, updatedTeam, user, headers) {
		// Make a copy of the original team for auditing purposes
		let originalTeam = Team.auditCopy(team);

		// Update the updated date
		team.updated = Date.now();

		// Copy in the fields that can be changed by the user
		copyMutableFields(team, updatedTeam);

		// Audit the update action
		await auditService.audit('team updated', 'team', 'update', TeamMember.auditCopy(user), { before: originalTeam, after: Team.auditCopy(team) }, headers);

		// Save the updated team
		return team.save();
	}

	/**
	 * Deletes an existing team, after verifying that team contains no more resources.
	 *
	 * @param team The team object to delete
	 * @param user The user requesting the delete
	 * @returns {Promise} Returns a promise that resolves if team is successfully deleted, and rejects otherwise
	 */
	async function deleteTeam(team, user, headers) {
		await verifyNoResourcesInTeam(team);

		// Audit the team delete attempt
		await auditService.audit('team deleted', 'team', 'delete', TeamMember.auditCopy(user), Team.auditCopy(team), headers);

		// Delete the team and update all members in the team
		return Promise.all([
			team.remove(),
			TeamMember.update(
				{'teams._id': team._id },
				{ $pull: { teams: { _id: team._id } } }
			)
		]);
	}

	async function searchTeams(search, query, queryParams, user) {
		let page = util.getPage(queryParams);
		let limit = util.getLimit(queryParams, 1000);

		let offset = page * limit;

		// Default to sorting by ID
		let sortArr = [{property: '_id', direction: 'DESC'}];
		if (null != queryParams.sort && null != queryParams.dir) {
			sortArr = [{property: queryParams.sort, direction: queryParams.dir}];
		}

		// If user is not an admin, constrain the results to the user's teams
		if (!userAuthService.hasRoles(user, ['admin'], config.auth)) {
			let [userTeams, implicitTeams] = await Promise.all([getMemberTeamIds(user), getImplicitTeamIds(user)]);

			let teamIds = [...userTeams, ...implicitTeams];

			// If the query already has a filter by team, take the intersection
			if (null != query._id && null != query._id.$in) {
				teamIds = _.intersection(teamIds, query._id.$in);
			}

			// If no remaining teams, return no results
			if (teamIds.length === 0) {
				return Promise.resolve();
			}

			query._id = {
				$in: teamIds
			};
		}

		let result = await Team.search(query, search, limit, offset, sortArr);

		if (null == result) {
			return {
				totalSize: 0,
				pageNumber: 0,
				pageSize: limit,
				totalPages: 0,
				elements: []
			};
		}
		return {
			totalSize: result.count,
			pageNumber: page,
			pageSize: limit,
			totalPages: Math.ceil(result.count / limit),
			elements: result.results
		};
	}

	async function searchTeamMembers(search, query, queryParams, team) {
		let page = util.getPage(queryParams);
		let limit = util.getLimit(queryParams);

		let offset = page * limit;

		// Default to sorting by ID
		let sortArr = [{property: '_id', direction: 'DESC'}];
		if (null != queryParams.sort && null != queryParams.dir) {
			sortArr = [{property: queryParams.sort, direction: queryParams.dir}];
		}

		// Inject the team query parameters
		// Finds members explicitly added to the team using the id OR
		// members implicitly added by having the externalGroup required by requiresExternalTeam
		query = query || {};
		query.$or = [
			{'teams._id': team._id}
		];

		const implicitTeamStrategy = _.get(config, 'teams.implicitMembers.strategy', null);

		if (implicitTeamStrategy === 'roles' && team.requiresExternalRoles && team.requiresExternalRoles.length > 0) {
			query.$or.push({
				$and: [{
					externalRoles: { $exists: true }
				}, {
					externalRoles: { $ne: null }
				}, {
					externalRoles: { $ne: [] }
				}, {
					externalRoles: { $not: { $elemMatch: { $nin: team.requiresExternalRoles } } }
				}]
			});
		}
		if (implicitTeamStrategy === 'teams' && team.requiresExternalTeams && team.requiresExternalTeams.length > 0) {
			query.$or.push({
				$and: [{
					externalGroups: { $elemMatch: { $in: team.requiresExternalTeams } }
				}]
			});
		}

		let results = await TeamMember.search(query, search, limit, offset, sortArr);

		// Create the return copy of the users
		const members = results.results.map((result) => TeamMember.teamCopy(result, team._id));

		return {
			totalSize: results.count,
			pageNumber: page,
			pageSize: limit,
			totalPages: Math.ceil(results.count/limit),
			elements: members
		};
	}

	/**
	 * Adds a new member to the existing team.
	 *
	 * @param user The user to add to the team
	 * @param team The team object
	 * @param role The role of the user in this team
	 * @param requester The user requesting the add
	 * @returns {Promise} Returns a promise that resolves if the user is successfully added to the team, and rejects otherwise
	 */
	async function addMemberToTeam(user, team, role, requester, headers) {
		// Audit the member add request
		await auditService.audit(`team ${role} added`, 'team-role', 'user add', TeamMember.auditCopy(requester), Team.auditCopyTeamMember(team, user, role), headers);

		return TeamMember.update({ _id: user._id }, { $addToSet: { teams: new TeamRole({ _id: team._id, role: role }) } }).exec();
	}

	const addMembersToTeam = async (users, team, requester, headers) => {
		users = users || [];
		users = users.filter((user) => null != user._id);

		return Promise.all(users.map(async (u) => {
			const user = await TeamMember.findOne({_id: u._id});
			if (null != user) {
				return await addMemberToTeam(user, team, u.role, requester, headers);
			}
		}));
	};

	async function updateMemberRole(user, team, role, requester, headers) {
		let currentRole = getTeamRole(user, team);

		if (null != currentRole && currentRole === 'admin') {
			await verifyNotLastAdmin(user, team);
		}

		await validateTeamRole(role);

		// Audit the member update request
		await auditService.audit(`team role changed to ${role}`, 'team-role', 'user add', TeamMember.auditCopy(requester), Team.auditCopyTeamMember(team, user, role), headers);

		return TeamMember.findOneAndUpdate({ _id: user._id, 'teams._id': team._id }, { $set: { 'teams.$.role': role } }).exec();
	}

	/**
	 * Removes an existing member from an existing team, after verifying that member is not the last admin
	 * on the team.
	 *
	 * @param user The user to remove
	 * @param team The team object
	 * @param requester The user requesting the removal
	 * @returns {Promise} Returns a promise that resolves if the user is successfully removed from the team, and rejects otherwise
	 */
	async function removeMemberFromTeam(user, team, requester, headers) {
		// Verify the user is not the last admin in the team
		await verifyNotLastAdmin(user, team);

		// Audit the user remove
		await auditService.audit('team member removed', 'team-role', 'user remove', TeamMember.auditCopy(requester), Team.auditCopyTeamMember(team, user, ''), headers);

		// Apply the update
		return TeamMember.update({_id: user._id}, {$pull: {teams: {_id: team._id}}}).exec();
	}

	async function sendRequestEmail(toEmail, requester, team, req) {
		try {
			let mailOptions = await emailService.generateMailOptions(requester, null, config.coreEmails.teamAccessRequestEmail, {
				team: team
			}, {
				team: team
			}, {
				bcc: toEmail
			});
			await emailService.sendMail(mailOptions);
			logger.debug(`Sent approved user (${requester.username}) alert email`);
		} catch (error) {
			// Log the error but this shouldn't block
			logger.error({err: error, req: req}, 'Failure sending email.');
		}
	}

	async function requestAccessToTeam(requester, team, req) {
		// Lookup the emails of all team admins
		let admins = await TeamMember.find({ teams: { $elemMatch: { _id: mongoose.Types.ObjectId(team._id), role: 'admin' } }}).exec();

		if (null == admins) {
			return Promise.reject({ status: 404, message: 'Error retrieving team admins' });
		}

		let adminEmails = admins.map((admin) => admin.email);

		if (null == adminEmails || adminEmails.length === 0) {
			return Promise.reject({ status: 404, message: 'Error retrieving team admins' });
		}

		// Add requester role to user for this team
		await addMemberToTeam(requester, team, 'requester', requester, req.headers);

		return sendRequestEmail(adminEmails, requester, team, req);
	}

	async function requestNewTeam(org, aoi, description, requester, req) {
		if (null == org) {
			return Promise.reject({ status: 400, message: 'Organization cannot be empty' });
		}
		if (null == aoi) {
			return Promise.reject({ status: 400, message: 'AOI cannot be empty' });
		}
		if (null == description) {
			return Promise.reject({ status: 400, message: 'Description cannot be empty' });
		}
		if (null == requester) {
			return Promise.reject({ status: 400, message: 'Invalid requester' });
		}

		try {
			await auditService.audit('new team requested', 'team', 'request', TeamMember.auditCopy(requester), { org, aoi, description }, req.headers);

			let mailOptions = await emailService.generateMailOptions(requester, req, config.coreEmails.newTeamRequest, {
				org: org,
				aoi: aoi,
				description: description
			});
			await emailService.sendMail(mailOptions);
			logger.debug('Sent team request email');
		} catch (error) {
			// Log the error but this shouldn't block
			logger.error({err: error, req: req}, 'Failure sending email.');
		}
	}

	/**
	 * Team authorization Middleware
	 */
	async function getImplicitTeamIds(user) {
		// Validate the user input
		if (null == user) {
			return Promise.reject({ status: 401, type: 'bad-request', message: 'User does not exist' });
		}

		if (user.constructor.name === 'model') {
			user = user.toObject();
		}

		const strategy = _.get(config, 'teams.implicitMembers.strategy', null);

		if (strategy == null) {
			return [];
		}

		const query = { $and: [{ implicitMembers: true }]};
		if (strategy === 'roles' && user.externalRoles && user.externalRoles.length > 0) {
			query.$and.push({
				requiresExternalRoles: { $exists: true }
			}, {
				requiresExternalRoles: { $ne: null }
			}, {
				requiresExternalRoles: { $ne: [] }
			}, {
				requiresExternalRoles: { $not: { $elemMatch: { $nin: user.externalRoles } } }
			});
		}
		if (strategy === 'teams' && user.externalGroups && user.externalGroups.length > 0) {
			query.$and.push({
				requiresExternalTeams: { $elemMatch: { $in: user.externalGroups } }
			});
		}

		if (query.$and.length === 1) {
			return [];
		}

		return Team.distinct('_id', query).exec();
	}

	async function getTeamIds(user, ...roles) {
		// Validate the user input
		if (null == user) {
			return Promise.reject({ status: 401, type: 'bad-request', message: 'User does not exist' });
		}

		if (user.constructor.name === 'model') {
			user = user.toObject();
		}

		let userTeams = (_.isArray(user.teams)) ? user.teams : [];
		if (roles && roles.length > 0) {
			userTeams = userTeams.filter((t) => null != t.role && roles.includes(t.role));
		}

		let filteredTeamIds = userTeams.map((t) => t._id.toString());

		return Promise.resolve(filteredTeamIds);
	}

	async function getMemberTeamIds(user) {
		return getTeamIds(user, 'member', 'editor', 'admin');
	}

	async function getEditorTeamIds(user) {
		return getTeamIds(user, 'editor', 'admin');
	}

	async function getAdminTeamIds(user) {
		return getTeamIds(user, 'admin');
	}

	// Constrain a set of teamIds provided by the user to those the user actually has access to.
	async function filterTeamIds(user, teamIds) {
		let memberTeamIds = await getMemberTeamIds(user);

		// If there were no teamIds to filter by, return all the team ids
		if (null == teamIds || (_.isArray(teamIds) && teamIds.length === 0)) {
			return memberTeamIds;
		}
		// Else, return the intersection of the two
		return _.intersection(memberTeamIds, teamIds);
	}

	return {
		createTeam,
		getTeams,
		updateTeam,
		deleteTeam,
		searchTeams,
		searchTeamMembers,
		meetsOrExceedsRole,
		meetsRoleRequirement,
		isImplicitMember,
		meetsRequiredExternalTeams,
		meetsRequiredExternalRoles,
		getActiveTeamRole,
		requestNewTeam,
		requestAccessToTeam,
		addMemberToTeam,
		addMembersToTeam,
		updateMemberRole,
		removeMemberFromTeam,
		sendRequestEmail,
		getTeamIds,
		filterTeamIds,
		getMemberTeamIds,
		getEditorTeamIds,
		getAdminTeamIds,
		getImplicitTeamIds
	};
};
