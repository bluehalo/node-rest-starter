'use strict';

const _ = require('lodash'),
	mongoose = require('mongoose'),
	{
		config,
		dbs,
		emailService,
		logger,
		utilService
	} = require('../../../dependencies'),
	userAuthService = require('../user/auth/user-authorization.service'),
	Resource = dbs.admin.model('Resource'),
	TeamMember = dbs.admin.model('TeamUser'),
	TeamRole = dbs.admin.model('TeamRole'),
	User = dbs.admin.model('User');

/**
 * Import types for reference below
 *
 * @typedef {import('mongoose').PopulateOptions} PopulateOptions
 * @typedef {import('mongoose').Schema.Types.ObjectId} ObjectId
 * @typedef {import('./types').TeamDocument} TeamDocument
 * @typedef {import('./types').TeamModel} TeamModel
 * @typedef {import('../user/types').UserDocument} UserDocument
 */

const teamRolesMap = {
	blocked: { priority: -1 },
	requester: { priority: 0 },
	member: { priority: 1 },
	editor: { priority: 5 },
	admin: { priority: 7 }
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

const isObjectIdEqual = (value1, value2) => {
	return value1?.equals(value2) ?? false;
};

class TeamsService {
	constructor() {
		/**
		 * @type TeamModel
		 */
		this.model = dbs.admin.model('Team');
	}

	/**
	 * Creates a new team with the requested metadata
	 *
	 * @param teamInfo
	 * @param creator The user requesting the create
	 * @returns {Promise<TeamDocument>} Returns a promise that resolves if team is successfully created, and rejects otherwise
	 */
	async create(teamInfo, creator, firstAdmin) {
		// Create the new team model
		const newTeam = new this.model();

		copyMutableFields(newTeam, teamInfo);

		// Write the auto-generated metadata
		newTeam.creator = creator;
		newTeam.created = Date.now();
		newTeam.updated = Date.now();
		newTeam.creatorName = creator.name;

		// Nested teams
		if (teamInfo.parent) {
			const parentTeam = await this.model.findById(teamInfo.parent);
			newTeam.parent = parentTeam._id;
			newTeam.ancestors = [...parentTeam.ancestors, parentTeam._id];
		}

		let user = await User.findById(firstAdmin).exec();
		user = User.filteredCopy(user);

		// Save the new team
		const savedTeam = await newTeam.save();

		// Add first admin as first team member with admin role, or the creator if null
		await this.addMemberToTeam(user || creator, newTeam, 'admin');

		return this.read(savedTeam._id);
	}

	/**
	 * @param {string | mongoose.Types.ObjectId} id
	 * @param {string | PopulateOptions | Array<string | PopulateOptions>} [populate]
	 * @returns {Promise<TeamDocument>}
	 */
	read(id, populate = []) {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw { status: 400, type: 'validation', message: 'Invalid team ID' };
		}
		return this.model.findById(id).populate(populate).exec();
	}

	/**
	 * Updates an existing team with fresh metadata
	 *
	 * @param {TeamDocument} document The team object to update
	 * @param obj The obj with updated fields
	 * @returns {Promise<TeamDocument>} Returns a promise that resolves if team is successfully updated, and rejects otherwise
	 */
	update(document, obj) {
		// Update the updated date
		document.updated = Date.now();

		// Copy in the fields that can be changed by the user
		copyMutableFields(document, obj);

		// Save the updated team
		return document.save();
	}

	/**
	 * Deletes an existing team, after verifying that team contains no more resources.
	 *
	 * @param {TeamDocument} document The team object to delete
	 * @returns {Promise<TeamDocument>} Returns a promise that resolves if team is successfully deleted, and rejects otherwise
	 */
	async delete(document) {
		await this.verifyNoResourcesInTeam(document);

		// Delete the team and update all members in the team
		await Promise.all([
			document.delete(),
			TeamMember.updateMany(
				{ 'teams._id': document._id },
				{ $pull: { teams: { _id: document._id } } }
			).exec()
		]);

		return document;
	}

	/**
	 * @param queryParams
	 * @param {import('mongoose').FilterQuery<TeamDocument>} query
	 * @param {string} search
	 * @param {UserDocument} user
	 * @returns {Promise<import('../../common/mongoose/paginate.plugin').PagingResults<any>>}
	 */
	async search(queryParams, query, search, user) {
		const page = utilService.getPage(queryParams);
		const limit = utilService.getLimit(queryParams, 1000);
		const sort = utilService.getSortObj(queryParams, 'DESC', '_id');

		let teamIds = await this.getMemberTeamIds(user);

		// convert team ids to strings
		const teamIdStrings = teamIds.map((id) => id.toString());

		// If user is not an admin, constrain the results to the user's teams
		if (!userAuthService.hasRoles(user, ['admin'])) {
			// If the query already has a filter by team, take the intersection
			if (null != query._id && null != query._id.$in) {
				teamIds = _.intersectionWith(teamIds, query._id.$in, isObjectIdEqual);
			}

			// If no remaining teams, return no results
			if (teamIds.length === 0) {
				return Promise.resolve(utilService.getPagingResults(limit));
			}

			query._id = {
				$in: teamIds
			};
		}

		// get results
		const results = await this.model
			.find(query)
			.containsSearch(search)
			.sort(sort)
			.paginate(limit, page);

		// append isMember field to elements if user is part of the team
		results.elements = results.elements.map((res) => {
			return {
				...res.toJSON(),
				isMember: teamIdStrings.includes(res.id)
			};
		});

		return results;
	}

	/**
	 * Gets the role of this user in this team.
	 *
	 * @param team The team object of interest
	 * @param user The user object of interest
	 * @returns Returns the role of the user in the team or null if user doesn't belong to team.
	 */
	getTeamRole(user, team) {
		const ndx = _.findIndex(user.teams, (t) => t._id.equals(team._id));

		if (-1 !== ndx) {
			return user.teams[ndx].role;
		}

		const nestedTeamsEnabled = _.get(config, 'teams.nestedTeams', false);
		if (nestedTeamsEnabled) {
			for (const ancestor of team.ancestors || []) {
				const role = this.getTeamRole(user, ancestor);
				if (role) {
					return role;
				}
			}
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
	isImplicitMember(user, team) {
		const strategy = config?.teams?.implicitMembers?.strategy ?? null;

		if (strategy === 'roles') {
			return this.meetsRequiredExternalRoles(user, team);
		}
		if (strategy === 'teams') {
			return this.meetsRequiredExternalTeams(user, team);
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
	meetsRequiredExternalTeams(user, team) {
		if (true === user.bypassAccessCheck) {
			return true;
		}
		// Check the required external teams against the user's externalGroups
		return (
			_.intersection(team.requiresExternalTeams, user.externalGroups).length > 0
		);
	}

	/**
	 * Checks if the user meets the required external roles for this team.
	 * Requires matching all external roles.
	 *
	 * @param user
	 * @param team
	 * @returns {boolean}
	 */
	meetsRequiredExternalRoles(user, team) {
		if ((team.requiresExternalRoles?.length ?? 0) === 0) {
			return false;
		}
		// Check the required external roles against the user's externalRoles
		return (
			_.intersection(team.requiresExternalRoles, user.externalRoles).length ===
			team.requiresExternalRoles.length
		);
	}

	meetsRoleRequirement(user, team, role) {
		// Check role of the user in this team
		const userRole = this.getActiveTeamRole(user, team);

		if (null != userRole && this.meetsOrExceedsRole(userRole, role)) {
			return Promise.resolve();
		}

		return Promise.reject({
			status: 403,
			type: 'missing-roles',
			message: 'The user does not have the required roles for the team'
		});
	}

	/**
	 * Checks if user role meets or exceeds the requestedRole according to
	 * a pre-defined role hierarchy
	 *
	 * @returns {boolean}
	 */
	meetsOrExceedsRole(userRole, requestedRole) {
		if (
			null != userRole &&
			_.has(teamRolesMap, userRole) &&
			null != requestedRole &&
			_.has(teamRolesMap, requestedRole)
		) {
			return (
				teamRolesMap[userRole].priority >= teamRolesMap[requestedRole].priority
			);
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
	getActiveTeamRole(user, team) {
		if (user && user.constructor.name === 'model') {
			user = user.toObject();
		}

		// No matter what, we need to get these
		const teamRole = this.getTeamRole(user, team);

		// User has an explicit team role
		if (teamRole) {
			return teamRole;
		}

		const implicitMembersEnabled =
			(config?.teams?.implicitMembers?.strategy ?? null) !== null;

		// implicit team members is not enabled, or the team does not have implicit members enabled
		if (!implicitMembersEnabled || !team.implicitMembers) {
			// Return the team role
			return teamRole;
		}

		// If the user is active
		if (this.isImplicitMember(user, team)) {
			// implicit members get the default 'member' role.
			return 'member';
		}

		// Return null since the user is neither an explicit or implicit member of the team.
		return null;
	}

	/**
	 * Checks if there are resources that belong to the team
	 *
	 * @param team The team object of interest
	 * @returns A promise that resolves if there are no more resources in the team, and rejects otherwise
	 */
	async verifyNoResourcesInTeam(team) {
		const resources = await Resource.find({
			'owner.type': 'team',
			'owner._id': team._id
		}).exec();

		if (null != resources && resources.length > 0) {
			return Promise.reject({
				status: 400,
				type: 'bad-request',
				message: 'There are still resources in this group.'
			});
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
	async verifyNotLastAdmin(user, team) {
		// Search for all users who have the admin role set to true
		const results = await TeamMember.find({
			_id: { $ne: user._id },
			teams: { $elemMatch: { _id: team._id, role: 'admin' } }
		}).exec();

		// Just need to make sure we find one active admin who isn't this user
		const adminFound = results.some((u) => {
			const role = this.getActiveTeamRole(u, team);
			return role === 'admin';
		});

		if (adminFound) {
			return Promise.resolve();
		}
		return Promise.reject({
			status: 400,
			type: 'bad-request',
			message: 'Team must have at least one admin'
		});
	}

	/**
	 * Validates that the roles are one of the accepted values
	 */
	validateTeamRole(role) {
		if (-1 !== teamRoles.indexOf(role)) {
			return Promise.resolve();
		}

		return Promise.reject({
			status: 400,
			type: 'bad-argument',
			message: 'Team role does not exist'
		});
	}

	readTeamMember(id, populate = []) {
		const query = {
			_id: id
		};
		return TeamMember.findOne(query).populate(populate).exec();
	}

	getImplicitMemberFilter(team) {
		const implicitTeamStrategy =
			config?.teams?.implicitMembers?.strategy ?? null;
		if (
			implicitTeamStrategy === 'roles' &&
			team.requiresExternalRoles?.length > 0
		) {
			return {
				$and: [
					{ externalRoles: { $all: team.requiresExternalRoles } },
					{ 'teams._id': { $ne: team._id } }
				]
			};
		}
		if (
			implicitTeamStrategy === 'teams' &&
			team.requiresExternalTeams?.length > 0
		) {
			return {
				$and: [
					{ externalGroups: { $all: team.requiresExternalTeams } },
					{ 'teams._id': { $ne: team._id } }
				]
			};
		}
	}

	updateMemberFilter(query, team) {
		// Extract member types and roles for filtering
		const types = query.$and?.find((filter) => filter.type)?.type.$in ?? [];
		const roles = query.$and?.find((filter) => filter.role)?.role.$in ?? [];

		// Remove member types and roles filters from query
		_.remove(query.$and, (filter) => filter.type || filter.role);
		if (query.$and?.length === 0) {
			delete query.$and;
		}

		query.$or = [];
		if (types.length === 0 && roles.length === 0) {
			const implicitFilter = this.getImplicitMemberFilter(team);
			if (implicitFilter) {
				query.$or.push(implicitFilter);
			}
			query.$or.push({ 'teams._id': team._id });
		} else if (types.length > 0 && roles.length > 0) {
			if (types.indexOf('implicit') !== -1 && roles.indexOf('member') !== -1) {
				const implicitFilter = this.getImplicitMemberFilter(team);
				if (implicitFilter) {
					query.$or.push(implicitFilter);
				}
			}
			if (types.indexOf('explicit') !== -1) {
				query.$or.push({
					teams: { $elemMatch: { _id: team._id, role: { $in: roles } } }
				});
			}
		} else if (types.length > 0) {
			if (types.indexOf('implicit') !== -1) {
				const implicitFilter = this.getImplicitMemberFilter(team);
				if (implicitFilter) {
					query.$or.push(implicitFilter);
				}
			}
			if (types.indexOf('explicit') !== -1) {
				query.$or.push({ 'teams._id': team._id });
			}
		} /* roles.length > 0 */ else {
			if (roles.indexOf('member') !== -1) {
				const implicitFilter = this.getImplicitMemberFilter(team);
				if (implicitFilter) {
					query.$or.push(implicitFilter);
				}
			}
			query.$or.push({
				teams: { $elemMatch: { _id: team._id, role: { $in: roles } } }
			});
		}

		// If $or is empty, that means we have conflicting filters (i.e. implicit members with admin role) and should
		// return zero results.  Need to create invalid query to ensure no results are found.
		if (query.$or.length === 0) {
			query.$or.push({ 'teams.role': 'invalid' });
		}

		return query;
	}

	async searchTeamMembers(search, query, queryParams, team) {
		const page = utilService.getPage(queryParams);
		const limit = utilService.getLimit(queryParams);
		const sort = utilService.getSortObj(queryParams, 'DESC', '_id');

		query = this.updateMemberFilter(query ?? {}, team);

		const results = await TeamMember.find(query)
			.containsSearch(search)
			.sort(sort)
			.paginate(limit, page);

		// Create the return copy of the users
		results.elements = results.elements.map((element) =>
			TeamMember.teamCopy(element, team._id)
		);

		return results;
	}

	/**
	 * Adds a new member to the existing team.
	 *
	 * @param user The user to add to the team
	 * @param team The team object
	 * @param role The role of the user in this team
	 * @returns {Promise} Returns a promise that resolves if the user is successfully added to the team, and rejects otherwise
	 */
	addMemberToTeam(user, team, role) {
		return TeamMember.updateOne(
			{ _id: user._id },
			{
				$addToSet: {
					teams: new TeamRole({
						_id: team._id,
						role: role
					})
				}
			}
		).exec();
	}

	async updateMemberRole(user, team, role) {
		const currentRole = this.getTeamRole(user, team);

		if (currentRole === 'admin') {
			await this.verifyNotLastAdmin(user, team);
		}

		await this.validateTeamRole(role);

		return TeamMember.findOneAndUpdate(
			{
				_id: user._id,
				'teams._id': team._id
			},
			{ $set: { 'teams.$.role': role } }
		).exec();
	}

	/**
	 * Removes an existing member from an existing team, after verifying that member is not the last admin
	 * on the team.
	 *
	 * @param user The user to remove
	 * @param team The team object
	 * @returns {Promise} Returns a promise that resolves if the user is successfully removed from the team, and rejects otherwise
	 */
	async removeMemberFromTeam(user, team) {
		// Verify the user is not the last admin in the team
		await this.verifyNotLastAdmin(user, team);

		// Apply the update
		return TeamMember.updateOne(
			{ _id: user._id },
			{ $pull: { teams: { _id: team._id } } }
		).exec();
	}

	async sendRequestEmail(toEmail, requester, team, req) {
		try {
			const mailOptions = await emailService.generateMailOptions(
				requester,
				null,
				config.coreEmails.teamAccessRequestEmail,
				{
					team: team
				},
				{
					team: team
				},
				{
					bcc: toEmail
				}
			);
			await emailService.sendMail(mailOptions);
			logger.debug(`Sent approved user (${requester.username}) alert email`);
		} catch (error) {
			// Log the error but this shouldn't block
			logger.error({ err: error, req: req }, 'Failure sending email.');
		}
	}

	async requestAccessToTeam(requester, team, req) {
		// Lookup the emails of all team admins
		const admins = await TeamMember.find({
			teams: {
				$elemMatch: {
					_id: new mongoose.Types.ObjectId(team._id),
					role: 'admin'
				}
			}
		}).exec();

		const adminEmails = admins.map((admin) => admin.email);

		if (null == adminEmails || adminEmails.length === 0) {
			return Promise.reject({
				status: 404,
				message: 'Error retrieving team admins'
			});
		}

		// Add requester role to user for this team
		await this.addMemberToTeam(requester, team, 'requester');

		// Email template rendering requires simple objects and not Mongo classes
		return this.sendRequestEmail(adminEmails, requester, team.toJSON(), req);
	}

	async requestNewTeam(org, aoi, description, requester, req) {
		if (null == org) {
			return Promise.reject({
				status: 400,
				message: 'Organization cannot be empty'
			});
		}
		if (null == aoi) {
			return Promise.reject({ status: 400, message: 'AOI cannot be empty' });
		}
		if (null == description) {
			return Promise.reject({
				status: 400,
				message: 'Description cannot be empty'
			});
		}
		if (null == requester) {
			return Promise.reject({ status: 400, message: 'Invalid requester' });
		}

		try {
			const mailOptions = await emailService.generateMailOptions(
				requester,
				req,
				config.coreEmails.newTeamRequest,
				{
					org: org,
					aoi: aoi,
					description: description
				}
			);
			await emailService.sendMail(mailOptions);
			logger.debug('Sent team request email');
		} catch (error) {
			// Log the error but this shouldn't block
			logger.error({ err: error, req: req }, 'Failure sending email.');
		}
	}

	/**
	 * @param user
	 * @param {...string} roles
	 * @returns {Promise<mongoose.Types.ObjectId[]>}
	 */
	getExplicitTeamIds(user, ...roles) {
		// Validate the user input
		if (null == user) {
			return Promise.reject({
				status: 401,
				type: 'bad-request',
				message: 'User does not exist'
			});
		}

		if (user.constructor.name === 'model') {
			user = user.toObject();
		}

		let userTeams = _.isArray(user.teams) ? user.teams : [];
		if (roles && roles.length > 0) {
			userTeams = userTeams.filter(
				(t) => null != t.role && roles.includes(t.role)
			);
		}

		const userTeamIds = userTeams.map((t) => t._id);

		return Promise.resolve(userTeamIds);
	}

	/**
	 * @param user
	 * @param {...string} roles
	 * @returns {Promise<mongoose.Types.ObjectId[]>}
	 */
	async getImplicitTeamIds(user, ...roles) {
		// Validate the user input
		if (null == user) {
			return Promise.reject({
				status: 401,
				type: 'bad-request',
				message: 'User does not exist'
			});
		}

		/**
		 * @type {string | null}
		 */
		const strategy = config?.teams?.implicitMembers?.strategy ?? null;

		if (strategy == null || (roles.length > 0 && !roles.includes('member'))) {
			return Promise.resolve([]);
		}

		if (user.constructor.name === 'model') {
			user = user.toObject();
		}

		/**
		 * @type {import('mongoose').FilterQuery<TeamDocument>}
		 */
		const query = { $and: [{ implicitMembers: true }] };
		if (strategy === 'roles' && (user.externalRoles?.length ?? 0) > 0) {
			query.$and.push(
				{
					requiresExternalRoles: { $exists: true }
				},
				{
					requiresExternalRoles: { $ne: null }
				},
				{
					requiresExternalRoles: { $ne: [] }
				},
				{
					requiresExternalRoles: {
						$not: { $elemMatch: { $nin: user.externalRoles } }
					}
				}
			);
		}
		if (strategy === 'teams' && (user.externalGroups?.length ?? 0) > 0) {
			query.$and.push(
				{
					requiresExternalTeams: { $exists: true }
				},
				{
					requiresExternalTeams: { $ne: null }
				},
				{
					requiresExternalTeams: { $ne: [] }
				},
				{
					requiresExternalTeams: {
						$not: { $elemMatch: { $nin: user.externalGroups } }
					}
				}
			);
		}

		if (query.$and.length === 1) {
			return Promise.resolve([]);
		}

		const blockedTeamIds = await this.getExplicitTeamIds(user, 'blocked');
		if (blockedTeamIds.length > 0) {
			query.$and.push({
				_id: { $nin: blockedTeamIds }
			});
		}

		return this.model.distinct('_id', query).exec();
	}

	/**
	 * @param {mongoose.Types.ObjectId[]} teamIds
	 * @returns {Promise<mongoose.Types.ObjectId[]>}
	 */
	getNestedTeamIds(teamIds = []) {
		const nestedTeamsEnabled = config?.teams?.nestedTeams ?? false;
		if (!nestedTeamsEnabled || teamIds.length === 0) {
			return Promise.resolve([]);
		}

		return this.model
			.distinct('_id', {
				_id: { $nin: teamIds },
				ancestors: { $in: teamIds }
			})
			.exec();
	}

	/**
	 * @param {mongoose.Types.ObjectId[]} teamIds
	 * @returns {Promise<mongoose.Types.ObjectId[]>}
	 */
	getAncestorTeamIds(teamIds = []) {
		return this.model.distinct('ancestors', { _id: { $in: teamIds } }).exec();
	}

	/**
	 * @param user
	 * @param {...string} roles
	 * @returns {Promise<mongoose.Types.ObjectId[]>}
	 */
	async getTeamIds(user, ...roles) {
		const explicitTeamIds = await this.getExplicitTeamIds(user, ...roles);
		const implicitTeamIds = await this.getImplicitTeamIds(user, ...roles);
		const nestedTeamIds = await this.getNestedTeamIds([
			...new Set([...explicitTeamIds, ...implicitTeamIds])
		]);

		return [
			...new Set([...explicitTeamIds, ...implicitTeamIds, ...nestedTeamIds])
		];
	}

	/**
	 * @param user
	 * @returns {Promise<mongoose.Types.ObjectId[]>}
	 */
	getMemberTeamIds(user) {
		return this.getTeamIds(user, 'member', 'editor', 'admin');
	}

	/**
	 * @param user
	 * @returns {Promise<mongoose.Types.ObjectId[]>}
	 */
	getEditorTeamIds(user) {
		return this.getTeamIds(user, 'editor', 'admin');
	}

	/**
	 * @param user
	 * @returns {Promise<mongoose.Types.ObjectId[]>}
	 */
	getAdminTeamIds(user) {
		return this.getTeamIds(user, 'admin');
	}

	/**
	 * Constrain a set of teamIds provided by the user to those the user actually has access to.
	 *
	 * @param user
	 * @param {mongoose.Types.ObjectId[]} [teamIds]
	 * @returns {Promise<mongoose.Types.ObjectId[]>}
	 */
	async filterTeamIds(user, teamIds = []) {
		const memberTeamIds = await this.getMemberTeamIds(user);

		// If there were no teamIds to filter by, return all the team ids
		if (null == teamIds || (_.isArray(teamIds) && teamIds.length === 0)) {
			return memberTeamIds;
		}
		// Else, return the intersection of the two
		return _.intersectionWith(memberTeamIds, teamIds, isObjectIdEqual);
	}

	async updateTeams(user) {
		const strategy = config?.teams?.implicitMembers?.strategy ?? 'disabled';
		const nestedTeamsEnabled = config?.teams?.nestedTeams ?? false;

		if (strategy === 'disabled' && !nestedTeamsEnabled) {
			return;
		}

		const [adminTeamIds, editorTeamIds, memberTeamIds] = await Promise.all([
			this.getTeamIds(user, 'admin'),
			this.getTeamIds(user, 'editor'),
			this.getTeamIds(user, 'member')
		]);

		const filteredEditorTeamIds = _.differenceWith(
			editorTeamIds,
			adminTeamIds,
			isObjectIdEqual
		);
		const filteredMemberTeamIds = _.differenceWith(
			memberTeamIds,
			[...editorTeamIds, ...adminTeamIds],
			isObjectIdEqual
		);

		const updatedTeams = [
			...adminTeamIds.map((id) => ({ role: 'admin', _id: id })),
			...filteredEditorTeamIds.map((id) => ({ role: 'editor', _id: id })),
			...filteredMemberTeamIds.map((id) => ({ role: 'member', _id: id }))
		];

		user.teams = updatedTeams;
	}
}

module.exports = new TeamsService();
