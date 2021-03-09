'use strict';

const
	_ = require('lodash'),
	mongoose = require('mongoose'),

	userAuthService = require('../user/auth/user-authorization.service'),
	deps = require('../../../dependencies'),
	config = deps.config,
	dbs = deps.dbs,
	logger = deps.logger,
	emailService = deps.emailService,
	util = deps.utilService,

	Resource = dbs.admin.model('Resource'),
	TeamMember = dbs.admin.model('TeamUser'),
	Team = dbs.admin.model('Team'),
	TeamRole = dbs.admin.model('TeamRole'),
	User = dbs.admin.model('User');

const teamRolesMap = {
	requester: {priority: 0},
	member: {priority: 1},
	editor: {priority: 5},
	admin: {priority: 7}
};

// Array of team role keys
const teamRoles = _.keys(teamRolesMap);

/**
 * Copies the mutable fields from src to dest
 *
 * @param dest
 * @param src
 */
const copyMutableFields = (dest, src) => {
	dest.name = src.name;
	dest.description = src.description;
	dest.implicitMembers = src.implicitMembers;
	dest.requiresExternalRoles = src.requiresExternalRoles;
	dest.requiresExternalTeams = src.requiresExternalTeams;
};

/**
 * Gets the role of this user in this team.
 *
 * @param team The team object of interest
 * @param user The user object of interest
 * @returns Returns the role of the user in the team or null if user doesn't belong to team.
 */
const getTeamRole = (user, team) => {
	const ndx = _.findIndex(user.teams, (t) => t._id.equals(team._id));

	if (-1 !== ndx) {
		return user.teams[ndx].role;
	}

	return null;
};

/**
 * Checks if the user meets the required external teams for this team
 * If the user is bypassed, they automatically meet the required external teams
 *
 * @param user
 * @param team
 * @returns {boolean}
 */
const isImplicitMember = (user, team) => {
	const strategy = _.get(config, 'teams.implicitMembers.strategy', null);

	if (strategy === 'roles') {
		return meetsRequiredExternalRoles(user, team);
	}
	if (strategy === 'teams') {
		return meetsRequiredExternalTeams(user, team);
	}
	return false;
};

/**
 * Checks if the user meets the required external teams for this team.
 * Requires matching only one external team.
 * If the user is bypassed, they automatically meet the required external teams
 *
 * @param user
 * @param team
 * @returns {boolean}
 */
const meetsRequiredExternalTeams = (user, team) => {
	if (true === user.bypassAccessCheck) {
		return true;
	}
	// Check the required external teams against the user's externalGroups
	return _.intersection(team.requiresExternalTeams, user.externalGroups).length > 0;
};

/**
 * Checks if the user meets the required external roles for this team.
 * Requires matching all external roles.
 *
 * @param user
 * @param team
 * @returns {boolean}
 */
const meetsRequiredExternalRoles = (user, team) => {
	if (team.requiresExternalRoles == null || team.requiresExternalRoles.length === 0) {
		return false;
	}
	// Check the required external roles against the user's externalRoles
	return _.intersection(team.requiresExternalRoles, user.externalRoles).length === team.requiresExternalRoles.length;
};

const meetsRoleRequirement = (user, team, role) => {
	// Check role of the user in this team
	const userRole = getActiveTeamRole(user, team);

	if (null != userRole && meetsOrExceedsRole(userRole, role)) {
		return Promise.resolve();
	}

	return Promise.reject({
		status: 403,
		type: 'missing-roles',
		message: 'The user does not have the required roles for the team'
	});
};

/**
 * Checks if user role meets or exceeds the requestedRole according to
 * a pre-defined role hierarchy
 *
 * @returns {boolean}
 */
const meetsOrExceedsRole = (userRole, requestedRole) => {
	if (null != userRole && _.has(teamRolesMap, userRole) && null != requestedRole && _.has(teamRolesMap, requestedRole)) {
		return (teamRolesMap[userRole].priority >= teamRolesMap[requestedRole].priority);
	}
	return false;
};

/**
 * Gets the team role for the specified user
 * and also applies the business logic of if they are implicitly a member
 * of the team or if they are an inactive explicit member of a team
 *
 * @returns Returns a role, or null if the user is not a member of the team
 */
const getActiveTeamRole = (user, team) => {
	if (user && user.constructor.name === 'model') {
		user = user.toObject();
	}

	// No matter what, we need to get these
	const teamRole = getTeamRole(user, team);

	// User has an explicit team role
	if (teamRole) {
		return teamRole;
	}

	const implicitMembersEnabled = _.get(config, 'teams.implicitMembers.strategy', null) !== null;

	// implicit team members is not enabled, or the team does not have implicit members enabled
	if (!implicitMembersEnabled || !team.implicitMembers) {
		// Return the team role
		return teamRole;
	}

	// If the user is active
	if (isImplicitMember(user, team)) {
		// implicit members get the default 'member' role.
		return 'member';
	}

	// Return null since the user is neither an explicit or implicit member of the team.
	return null;
};

/**
 * Checks if there are resources that belong to the team
 *
 * @param team The team object of interest
 * @returns A promise that resolves if there are no more resources in the team, and rejects otherwise
 */
const verifyNoResourcesInTeam = async (team) => {
	const resources = await Resource.find({'owner.type': 'team', 'owner._id': team._id}).exec();

	if (null != resources && resources.length > 0) {
		return Promise.reject({
			status: 400,
			type: 'bad-request',
			message: 'There are still resources in this group.'
		});
	}

	return Promise.resolve();
};

/**
 * Checks if the member is the last admin of the team
 *
 * @param user The user object of interest
 * @param team The team object of interest
 * @returns {Promise} Returns a promise that resolves if the user is not the last admin, and rejects otherwise
 */
const verifyNotLastAdmin = async (user, team) => {
	// Search for all users who have the admin role set to true
	const results = await TeamMember.find({
		_id: {$ne: user._id},
		teams: {$elemMatch: {_id: team._id, role: 'admin'}}
	}).exec();

	// Just need to make sure we find one active admin who isn't this user
	const adminFound = results.some((u) => {
		const role = getActiveTeamRole(u, team);
		return (null != role && role === 'admin');
	});

	if (adminFound) {
		return Promise.resolve();
	}
	return Promise.reject({status: 400, type: 'bad-request', message: 'Team must have at least one admin'});
};

/**
 * Validates that the roles are one of the accepted values
 */
const validateTeamRole = (role) => {
	if (-1 !== teamRoles.indexOf(role)) {
		return Promise.resolve();
	}

	return Promise.reject({status: 400, type: 'bad-argument', message: 'Team role does not exist'});
};

const readTeam = (id, populate = []) => {
	const query = {
		_id: id
	};
	return Team.findOne(query).populate(populate).exec();
};

const readTeamMember = (id, populate = []) => {
	const query = {
		_id: id
	};
	return TeamMember.findOne(query).populate(populate).exec();
};

/**
 * Creates a new team with the requested metadata
 *
 * @param teamInfo
 * @param creator The user requesting the create
 * @returns {Promise} Returns a promise that resolves if team is successfully created, and rejects otherwise
 */
const createTeam = async (teamInfo, creator, firstAdmin) => {
	// Create the new team model
	const newTeam = new Team();

	copyMutableFields(newTeam, teamInfo);

	// Write the auto-generated metadata
	newTeam.creator = creator;
	newTeam.created = Date.now();
	newTeam.updated = Date.now();
	newTeam.creatorName = creator.name;

	// Nested teams
	if (teamInfo.parent) {
		const parentTeam = await Team.findById(teamInfo.parent);
		newTeam.parent = parentTeam._id;
		newTeam.ancestors = [...parentTeam.ancestors, parentTeam._id];
	}

	let user = await User.findById(firstAdmin).exec();
	user = User.filteredCopy(user);

	// Save the new team
	await newTeam.save();

	// Add first admin as first team member with admin role, or the creator if null
	return addMemberToTeam(user || creator, newTeam, 'admin');
};

/**
 * Updates an existing team with fresh metadata
 *
 * @param team The team object to update
 * @param updatedTeam
 * @returns {Promise} Returns a promise that resolves if team is successfully updated, and rejects otherwise
 */
const updateTeam = (team, updatedTeam) => {
	// Update the updated date
	team.updated = Date.now();

	// Copy in the fields that can be changed by the user
	copyMutableFields(team, updatedTeam);

	// Save the updated team
	return team.save();
};

/**
 * Deletes an existing team, after verifying that team contains no more resources.
 *
 * @param team The team object to delete
 * @returns {Promise} Returns a promise that resolves if team is successfully deleted, and rejects otherwise
 */
const deleteTeam = async (team) => {
	await verifyNoResourcesInTeam(team);

	// Delete the team and update all members in the team
	return Promise.all([
		team.delete(),
		TeamMember.updateMany(
			{ 'teams._id': team._id },
			{ $pull: { teams: { _id: team._id } } }
		).exec()
	]);
};

const searchTeams = async (queryParams, query, search, user) => {
	const page = util.getPage(queryParams);
	const limit = util.getLimit(queryParams, 1000);
	const sortArr = util.getSort(queryParams, 'DESC', '_id');
	const offset = page * limit;

	// If user is not an admin, constrain the results to the user's teams
	if (!userAuthService.hasRoles(user, ['admin'])) {
		let teamIds = await getMemberTeamIds(user);

		// If the query already has a filter by team, take the intersection
		if (null != query._id && null != query._id.$in) {
			teamIds = _.intersectionBy(teamIds, query._id.$in, (i) => i.toString());
		}

		// If no remaining teams, return no results
		if (teamIds.length === 0) {
			return Promise.resolve(util.getPagingResults(limit));
		}

		query._id = {
			$in: teamIds
		};
	}

	const result = await Team.textSearch(query, search, limit, offset, sortArr);

	return util.getPagingResults(limit, page, result.count, result.results);
};

const searchTeamMembers = async (search, query, queryParams, team) => {
	const page = util.getPage(queryParams);
	const limit = util.getLimit(queryParams);
	const sortArr = util.getSort(queryParams, 'DESC', '_id');
	const offset = page * limit;

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
				externalRoles: {$exists: true}
			}, {
				externalRoles: {$ne: null}
			}, {
				externalRoles: {$ne: []}
			}, {
				externalRoles: {$not: {$elemMatch: {$nin: team.requiresExternalRoles}}}
			}]
		});
	}
	if (implicitTeamStrategy === 'teams' && team.requiresExternalTeams && team.requiresExternalTeams.length > 0) {
		query.$or.push({
			$and: [{
				externalGroups: {$elemMatch: {$in: team.requiresExternalTeams}}
			}]
		});
	}

	const results = await TeamMember.textSearch(query, search, limit, offset, sortArr);

	// Create the return copy of the users
	const members = results.results.map((result) => TeamMember.teamCopy(result, team._id));

	return util.getPagingResults(limit, page, results.count, members);
};

/**
 * Adds a new member to the existing team.
 *
 * @param user The user to add to the team
 * @param team The team object
 * @param role The role of the user in this team
 * @returns {Promise} Returns a promise that resolves if the user is successfully added to the team, and rejects otherwise
 */
const addMemberToTeam = (user, team, role) => {
	return TeamMember.updateOne({_id: user._id}, {
		$addToSet: {
			teams: new TeamRole({
				_id: team._id,
				role: role
			})
		}
	}).exec();
};

const updateMemberRole = async (user, team, role) => {
	const currentRole = getTeamRole(user, team);

	if (null != currentRole && currentRole === 'admin') {
		await verifyNotLastAdmin(user, team);
	}

	await validateTeamRole(role);

	return TeamMember.findOneAndUpdate({
		_id: user._id,
		'teams._id': team._id
	}, {$set: {'teams.$.role': role}}).exec();
};

/**
 * Removes an existing member from an existing team, after verifying that member is not the last admin
 * on the team.
 *
 * @param user The user to remove
 * @param team The team object
 * @returns {Promise} Returns a promise that resolves if the user is successfully removed from the team, and rejects otherwise
 */
const removeMemberFromTeam = async (user, team) => {
	// Verify the user is not the last admin in the team
	await verifyNotLastAdmin(user, team);

	// Apply the update
	return TeamMember.updateOne({_id: user._id}, {$pull: {teams: {_id: team._id}}}).exec();
};

const sendRequestEmail = async (toEmail, requester, team, req) => {
	try {
		const mailOptions = await emailService.generateMailOptions(requester, null, config.coreEmails.teamAccessRequestEmail, {
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
};

const requestAccessToTeam = async (requester, team, req) => {
	// Lookup the emails of all team admins
	const admins = await TeamMember.find({
		teams: {
			$elemMatch: {
				_id: mongoose.Types.ObjectId(team._id),
				role: 'admin'
			}
		}
	}).exec();

	const adminEmails = admins.map((admin) => admin.email);

	if (null == adminEmails || adminEmails.length === 0) {
		return Promise.reject({status: 404, message: 'Error retrieving team admins'});
	}

	// Add requester role to user for this team
	await addMemberToTeam(requester, team, 'requester');

	return sendRequestEmail(adminEmails, requester, team, req);
};

const requestNewTeam = async (org, aoi, description, requester, req) => {
	if (null == org) {
		return Promise.reject({status: 400, message: 'Organization cannot be empty'});
	}
	if (null == aoi) {
		return Promise.reject({status: 400, message: 'AOI cannot be empty'});
	}
	if (null == description) {
		return Promise.reject({status: 400, message: 'Description cannot be empty'});
	}
	if (null == requester) {
		return Promise.reject({status: 400, message: 'Invalid requester'});
	}

	try {
		const mailOptions = await emailService.generateMailOptions(requester, req, config.coreEmails.newTeamRequest, {
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
};

const getExplicitTeamIds = (user, ...roles) => {
	// Validate the user input
	if (null == user) {
		return Promise.reject({status: 401, type: 'bad-request', message: 'User does not exist'});
	}

	if (user.constructor.name === 'model') {
		user = user.toObject();
	}

	let userTeams = (_.isArray(user.teams)) ? user.teams : [];
	if (roles && roles.length > 0) {
		userTeams = userTeams.filter((t) => null != t.role && roles.includes(t.role));
	}

	const userTeamIds = userTeams.map((t) => t._id.toString());

	return Promise.resolve(userTeamIds);
};

/**
 * Team authorization Middleware
 */
const getImplicitTeamIds = (user, ...roles) => {
	// Validate the user input
	if (null == user) {
		return Promise.reject({status: 401, type: 'bad-request', message: 'User does not exist'});
	}

	const strategy = _.get(config, 'teams.implicitMembers.strategy', null);

	if (strategy == null || (roles.length > 0 && !roles.includes('member'))) {
		return Promise.resolve([]);
	}

	if (user.constructor.name === 'model') {
		user = user.toObject();
	}

	/**
	 * @type {any}
	 */
	const query = {$and: [{implicitMembers: true}]};
	if (strategy === 'roles' && user.externalRoles && user.externalRoles.length > 0) {
		query.$and.push({
			requiresExternalRoles: {$exists: true}
		}, {
			requiresExternalRoles: {$ne: null}
		}, {
			requiresExternalRoles: {$ne: []}
		}, {
			requiresExternalRoles: {$not: {$elemMatch: {$nin: user.externalRoles}}}
		});
	}
	if (strategy === 'teams' && user.externalGroups && user.externalGroups.length > 0) {
		query.$and.push({
			requiresExternalTeams: {$elemMatch: {$in: user.externalGroups}}
		});
	}

	if (query.$and.length === 1) {
		return Promise.resolve([]);
	}

	return Team.distinct('_id', query).exec();
};

const getNestedTeamIds = async (teamIds = []) => {
	const nestedTeamsEnabled = _.get(config, 'teams.nestedTeams', false);
	if (!nestedTeamsEnabled || teamIds.length === 0) {
		return Promise.resolve([]);
	}

	const mappedTeamIds = teamIds.map((teamId) => _.isString(teamId) ? mongoose.Types.ObjectId(teamId) : teamId);

	return await Team.distinct('_id', { _id: { $nin: mappedTeamIds }, ancestors: { $in: mappedTeamIds } }).exec();
};

const getTeamIds = async (user, ...roles) => {
	const explicitTeamIds = await getExplicitTeamIds(user, ...roles);
	const implicitTeamIds = await getImplicitTeamIds(user, ...roles);
	const nestedTeamIds = await getNestedTeamIds([...explicitTeamIds, ...implicitTeamIds]);

	return [...explicitTeamIds, ...implicitTeamIds, ...nestedTeamIds];
};

const getMemberTeamIds = (user) => getTeamIds(user, 'member', 'editor', 'admin');

const getEditorTeamIds = (user) => getTeamIds(user, 'editor', 'admin');

const getAdminTeamIds = (user) => getTeamIds(user, 'admin');

// Constrain a set of teamIds provided by the user to those the user actually has access to.
const filterTeamIds = async (user, teamIds) => {
	const memberTeamIds = await getMemberTeamIds(user);

	// If there were no teamIds to filter by, return all the team ids
	if (null == teamIds || (_.isArray(teamIds) && teamIds.length === 0)) {
		return memberTeamIds;
	}
	// Else, return the intersection of the two
	return _.intersection(memberTeamIds, teamIds);
};

const updateTeams = async (user) => {

	const strategy = _.get(config, 'teams.implicitMembers.strategy', 'disabled');
	const nestedTeamsEnabled = _.get(config, 'teams.nestedTeams', false);

	if (strategy === 'disabled' && !nestedTeamsEnabled) {
		return;
	}

	const [adminTeamIds, editorTeamIds, memberTeamIds] = await Promise.all([
		getTeamIds(user, 'admin'), getTeamIds(user, 'editor'), getTeamIds(user, 'member')]);

	const filteredEditorTeamIds = _.difference(editorTeamIds, adminTeamIds);
	const filteredMemberTeamIds = _.difference(memberTeamIds, editorTeamIds);

	const updatedTeams = [
		...adminTeamIds.map((id) => ({ role: 'admin', _id: id })),
		...filteredEditorTeamIds.map((id) => ({ role: 'editor', _id: id })),
		...filteredMemberTeamIds.map((id) => ({ role: 'member', _id: id }))
	];

	user.teams = updatedTeams;
};

module.exports = {
	createTeam,
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
	updateMemberRole,
	removeMemberFromTeam,
	sendRequestEmail,
	getExplicitTeamIds,
	getImplicitTeamIds,
	getNestedTeamIds,
	getTeamIds,
	getMemberTeamIds,
	getEditorTeamIds,
	getAdminTeamIds,
	filterTeamIds,
	readTeam,
	readTeamMember,
	updateTeams
};
