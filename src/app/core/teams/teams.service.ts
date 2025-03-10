import _ from 'lodash';
import mongoose, { FilterQuery, PopulateOptions, Types } from 'mongoose';

import {
	TeamRoleImplicit,
	TeamRoleMinimumWithAccess,
	TeamRolePriorities,
	TeamRoles
} from './team-role.model';
import { ITeam, Team, TeamDocument, TeamModel } from './team.model';
import { config, emailService, utilService } from '../../../dependencies';
import { logger } from '../../../lib/logger';
import {
	BadRequestError,
	ForbiddenError,
	InternalServerError,
	NotFoundError
} from '../../common/errors';
import { PagingResults } from '../../common/mongoose/paginate.plugin';
import { IdOrObject, Override } from '../../common/typescript-util';
import userAuthService from '../user/auth/user-authorization.service';
import { IUser, User, UserDocument, UserModel } from '../user/user.model';

/**
 * Copies the mutable fields from src to dest
 */
const copyMutableFields = (dest: ITeam, src: Partial<ITeam>) => {
	dest.name = src.name;
	dest.description = src.description;
	dest.implicitMembers = src.implicitMembers;
	dest.requiresExternalRoles = src.requiresExternalRoles;
	dest.requiresExternalTeams = src.requiresExternalTeams;
};

const isObjectIdEqual = (value1: Types.ObjectId, value2: Types.ObjectId) => {
	return value1?.equals(value2) ?? false;
};

class TeamsService {
	constructor(
		private model: TeamModel,
		private userModel: UserModel
	) {}

	/**
	 * Creates a new team with the requested metadata
	 *
	 * @returns Returns a promise that resolves if team is successfully created, and rejects otherwise
	 */
	async create(
		teamInfo: Partial<
			Override<ITeam, 'parent', IdOrObject<string | Types.ObjectId>>
		>,
		creator: UserDocument,
		firstAdmin?: string | Types.ObjectId
	): Promise<TeamDocument> {
		// Create the new team model
		const newTeam = new this.model();

		copyMutableFields(newTeam, teamInfo as ITeam);

		// Write the auto-generated metadata
		newTeam.creator = creator._id;
		newTeam.creatorName = creator.name;

		// Nested teams
		if (teamInfo.parent) {
			const parentTeam = await this.read(utilService.getId(teamInfo.parent));
			newTeam.parent = parentTeam._id;
			newTeam.ancestors = [...parentTeam.ancestors, parentTeam._id];
		}

		const user = await this.userModel.findById(firstAdmin).exec();

		// Save the new team
		const savedTeam = await newTeam.save();

		// Add first admin as first team member with admin role, or the creator if null
		await this.addMemberToTeam(user || creator, newTeam, TeamRoles.Admin);

		return savedTeam;
	}

	read(
		id: string | Types.ObjectId,
		populate:
			| string
			| string[]
			| PopulateOptions
			| Array<string | PopulateOptions> = []
	): Promise<TeamDocument | null> {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			return Promise.reject(new NotFoundError('Invalid team ID'));
		}
		return this.model
			.findById(id)
			.populate(populate as string[])
			.exec();
	}

	/**
	 * Updates an existing team with fresh metadata
	 *
	 * @param document The team object to update
	 * @param obj The obj with updated fields
	 * @returns Returns a promise that resolves if team is successfully updated, and rejects otherwise
	 */
	update(document: TeamDocument, obj: Partial<ITeam>): Promise<TeamDocument> {
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
	async delete(document: TeamDocument): Promise<TeamDocument> {
		await this.verifyNoResourcesInTeam(document);

		// Delete the team and update all members in the team
		await Promise.all([
			document.deleteOne(),
			this.userModel
				.updateMany(
					{ 'teams._id': document._id },
					{ $pull: { teams: { _id: document._id } } }
				)
				.exec()
		]);

		return document;
	}

	async search(
		queryParams = {},
		query: FilterQuery<TeamDocument> = {},
		search = '',
		user: UserDocument
	): Promise<PagingResults<TeamDocument>> {
		const page = utilService.getPage(queryParams);
		const limit = utilService.getLimit(queryParams, 1000);
		const sort = utilService.getSortObj(queryParams, 'DESC', '_id');

		let teamIds = await this.getTeamIds(
			user,
			...this.getRoles(TeamRoleMinimumWithAccess)
		);

		// convert team ids to strings
		const teamIdStrings = new Set(teamIds.map((id) => id.toString()));

		// If user is not an admin, constrain the results to the user's teams
		if (!userAuthService.hasRoles(user, ['admin'])) {
			// If the query already has a filter by team, take the intersection
			if (null != query._id && null != query._id.$in) {
				teamIds = _.intersectionWith(teamIds, query._id.$in, isObjectIdEqual);
			}

			// If no remaining teams, return no results
			if (teamIds.length === 0) {
				return Promise.resolve({
					pageSize: limit,
					pageNumber: 0,
					totalSize: 0,
					totalPages: 0,
					elements: []
				});
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

		return {
			pageNumber: results.pageNumber,
			pageSize: results.pageSize,
			totalPages: results.totalPages,
			totalSize: results.totalSize,
			elements: results.elements.map((res) => {
				// append isMember field to elements if user is part of the team
				return {
					...res.toJSON(),
					isMember: teamIdStrings.has(res._id.toString())
				} as unknown as TeamDocument;
			})
		};
	}

	/**
	 * Gets the role of this user in this team.  If the team is nested, it will check the user's
	 * role on all ancestor teams and grant the highest assigned role.
	 *
	 * @returns Returns the role of the user in the team or null if user doesn't belong to team.
	 */
	getTeamRole(
		user: UserDocument,
		team: Pick<TeamDocument, '_id'> & Partial<Pick<TeamDocument, 'ancestors'>>
	): TeamRoles | null {
		if (team.ancestors && config.get<boolean>('teams.nestedTeams')) {
			const roles = [...team.ancestors, team._id]
				.map((_id) => this.getTeamRole(user, { _id }))
				.filter(Boolean) as TeamRoles[];

			if (roles.length > 0) {
				let highestRole = TeamRoles.Blocked;
				for (const role of roles) {
					if (
						TeamRolePriorities[role] > (TeamRolePriorities[highestRole] ?? -1)
					) {
						highestRole = role;
					}
				}
				return highestRole;
			}
		} else {
			return user.teams.find((t) => t._id.equals(team._id))?.role;
		}
		return null;
	}

	/**
	 * Checks if the user meets the required external teams for this team
	 * If the user is bypassed, they automatically meet the required external teams
	 */
	isImplicitMember(user: UserDocument, team: TeamDocument): boolean {
		if (config.get<boolean>('teams.implicitMembers.enabled')) {
			const strategy = config.get<string>('teams.implicitMembers.strategy');

			if (strategy === 'roles') {
				return this.meetsRequiredExternalRoles(user, team);
			}
			if (strategy === 'teams') {
				return this.meetsRequiredExternalTeams(user, team);
			}
		}
		return false;
	}

	/**
	 * Checks if the user meets the required external teams for this team.
	 * Requires matching only one external team.
	 * If the user is bypassed, they automatically meet the required external teams
	 */
	meetsRequiredExternalTeams(user: UserDocument, team: TeamDocument): boolean {
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
	 */
	meetsRequiredExternalRoles(user: UserDocument, team: TeamDocument): boolean {
		if ((team.requiresExternalRoles?.length ?? 0) === 0) {
			return false;
		}
		// Check the required external roles against the user's externalRoles
		return (
			_.intersection(team.requiresExternalRoles, user.externalRoles).length ===
			team.requiresExternalRoles.length
		);
	}

	meetsRoleRequirement(
		user: UserDocument,
		team: TeamDocument,
		role: TeamRoles
	): Promise<void> {
		// Check role of the user in this team
		const userRole = this.getActiveTeamRole(user, team);

		if (null != userRole && this.meetsOrExceedsRole(userRole, role)) {
			return Promise.resolve();
		}

		return Promise.reject(
			new ForbiddenError(
				'The user does not have the required roles for the team'
			)
		);
	}

	/**
	 * Checks if user role meets or exceeds the requestedRole according to
	 * a pre-defined role hierarchy
	 */
	meetsOrExceedsRole(userRole: TeamRoles, requestedRole: TeamRoles): boolean {
		if (
			null != userRole &&
			_.has(TeamRolePriorities, userRole) &&
			null != requestedRole &&
			_.has(TeamRolePriorities, requestedRole)
		) {
			return TeamRolePriorities[userRole] >= TeamRolePriorities[requestedRole];
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
	getActiveTeamRole(user: UserDocument, team: TeamDocument): TeamRoles | null {
		// No matter what, we need to get these
		const teamRole = this.getTeamRole(user, team);

		// User has an explicit team role
		if (teamRole) {
			return teamRole;
		}

		const implicitMembersEnabled = config.get<boolean>(
			'teams.implicitMembers.enabled'
		);

		if (
			implicitMembersEnabled &&
			team.implicitMembers &&
			this.isImplicitMember(user, team)
		) {
			// implicit members get the default 'member' role.
			return TeamRoles.Member;
		}

		// Return null since the user is neither an explicit nor implicit member of the team.
		return null;
	}

	/**
	 * Checks if there are resources that belong to the team
	 *
	 * @param team The team object of interest
	 * @returns A promise that resolves if there are no more resources in the team, and rejects otherwise
	 */
	async verifyNoResourcesInTeam(team: TeamDocument): Promise<void> {
		const resourceCount = await this.getResourceCount(team);

		if (resourceCount > 0) {
			return Promise.reject(
				new BadRequestError('There are still resources in this team.')
			);
		}

		return Promise.resolve();
	}

	/**
	 * Stub implementation. Downstream projects can implement their own custom resource count logic to prevent team deletion.
	 */
	getResourceCount(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_team: TeamDocument
	): Promise<number> {
		return Promise.resolve(0);
	}

	/**
	 * Checks if the member is the last admin of the team
	 *
	 * @param user The user object of interest
	 * @param team The team object of interest
	 * @returns Returns a promise that resolves if the user is not the last admin, and rejects otherwise
	 */
	async verifyNotLastAdmin(
		user: UserDocument,
		team: TeamDocument
	): Promise<void> {
		// Search for all users who have the admin role set to true
		const results = await this.userModel
			.find({
				_id: { $ne: user._id },
				teams: { $elemMatch: { _id: team._id, role: 'admin' } }
			})
			.exec();

		// Just need to make sure we find one active admin who isn't this user
		const adminFound = results.some((u) => {
			const role = this.getActiveTeamRole(u, team);
			return role === 'admin';
		});

		if (adminFound) {
			return Promise.resolve();
		}
		return Promise.reject(
			new BadRequestError('Team must have at least one admin')
		);
	}

	private getImplicitMemberFilter(
		team: TeamDocument
	): FilterQuery<TeamDocument> {
		const implicitTeamStrategy = config.get<string>(
			'teams.implicitMembers.strategy'
		);
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

	updateMemberFilter(query: FilterQuery<UserDocument>, team: TeamDocument) {
		// Extract member types and roles for filtering
		const types = query.$and?.find((filter) => filter.type)?.type.$in ?? [];
		const roles: TeamRoles[] =
			query.$and?.find((filter) => filter.role)?.role.$in ?? [];

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
			if (types.includes('implicit') && roles.includes(TeamRoleImplicit)) {
				const implicitFilter = this.getImplicitMemberFilter(team);
				if (implicitFilter) {
					query.$or.push(implicitFilter);
				}
			}
			if (types.includes('explicit')) {
				query.$or.push({
					teams: { $elemMatch: { _id: team._id, role: { $in: roles } } }
				});
			}
		} else if (types.length > 0) {
			if (types.includes('implicit')) {
				const implicitFilter = this.getImplicitMemberFilter(team);
				if (implicitFilter) {
					query.$or.push(implicitFilter);
				}
			}
			if (types.includes('explicit')) {
				query.$or.push({ 'teams._id': team._id });
			}
		} /* roles.length > 0 */ else {
			if (roles.includes(TeamRoleImplicit)) {
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

	/**
	 * Adds a new member to the existing team.
	 *
	 * @param user The user to add to the team
	 * @param team The team object
	 * @param role The role of the user in this team
	 * @returns Returns a promise that resolves if the user is successfully added to the team, and rejects otherwise
	 */
	addMemberToTeam(
		user: UserDocument,
		team: TeamDocument,
		role: TeamRoles
	): Promise<UserDocument> {
		return this.userModel
			.findOneAndUpdate(
				{ _id: user._id },
				{
					$addToSet: {
						teams: {
							_id: team._id,
							role: role
						}
					}
				}
			)
			.exec();
	}

	async updateMemberRole(
		user: UserDocument,
		team: TeamDocument,
		role: TeamRoles
	): Promise<UserDocument> {
		const currentRole = this.getTeamRole(user, team);

		if (currentRole === 'admin') {
			await this.verifyNotLastAdmin(user, team);
		}

		return this.userModel
			.findOneAndUpdate(
				{
					_id: user._id,
					'teams._id': team._id
				},
				{ $set: { 'teams.$.role': role } }
			)
			.exec();
	}

	/**
	 * Removes an existing member from an existing team, after verifying that member is not the last admin
	 * on the team.
	 *
	 * @param user The user to remove
	 * @param team The team object
	 * @returns {Promise} Returns a promise that resolves if the user is successfully removed from the team, and rejects otherwise
	 */
	async removeMemberFromTeam(user: UserDocument, team: TeamDocument) {
		// Verify the user is not the last admin in the team
		await this.verifyNotLastAdmin(user, team);

		// Apply the update
		return this.userModel
			.findOneAndUpdate(
				{ _id: user._id },
				{ $pull: { teams: { _id: team._id } } }
			)
			.exec();
	}

	async sendRequestEmail(
		toEmail: string[],
		requester: UserDocument,
		team: TeamDocument
	): Promise<void> {
		try {
			const mailOptions = await emailService.generateMailOptions(
				requester,
				config.get('coreEmails.teamAccessRequestEmail'),
				{
					team: team.toJSON()
				},
				{
					team: team.toJSON()
				},
				{
					bcc: toEmail
				}
			);
			await emailService.sendMail(mailOptions);
			logger.debug(`Sent approved user (${requester.username}) alert email`);
		} catch (error) {
			// Log the error but this shouldn't block
			logger.error('Failure sending email.', { err: error });
		}
	}

	async requestAccessToTeam(
		requester: UserDocument,
		team: TeamDocument
	): Promise<void> {
		// Lookup the emails of all team admins
		const admins = await this.userModel
			.find({
				teams: {
					$elemMatch: {
						_id: new mongoose.Types.ObjectId(team._id),
						role: TeamRoles.Admin
					}
				}
			})
			.exec();

		const adminEmails = admins.map((admin) => admin.email);

		if (null == adminEmails || adminEmails.length === 0) {
			return Promise.reject(
				new InternalServerError('Error retrieving team admins')
			);
		}

		// Add requester role to user for this team
		await this.addMemberToTeam(requester, team, TeamRoles.Requester);

		// Email template rendering requires simple objects and not Mongo classes
		return this.sendRequestEmail(adminEmails, requester, team);
	}

	async requestNewTeam(
		org: string,
		aoi: string,
		description: string,
		requester: UserDocument
	): Promise<void> {
		if (null == org) {
			return Promise.reject(
				new BadRequestError('Organization cannot be empty')
			);
		}
		if (null == aoi) {
			return Promise.reject(new BadRequestError('AOI cannot be empty'));
		}
		if (null == description) {
			return Promise.reject(new BadRequestError('Description cannot be empty'));
		}
		if (null == requester) {
			return Promise.reject(new BadRequestError('Invalid requester'));
		}

		try {
			const mailOptions = await emailService.generateMailOptions(
				requester,
				config.get('coreEmails.newTeamRequest'),
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
			logger.error('Failure sending email.', { err: error });
		}
	}

	getExplicitTeamIds(
		user: IUser,
		...roles: TeamRoles[]
	): Promise<Types.ObjectId[]> {
		// Validate the user input
		// This check shouldn't be need once strictNullChecks is enabled
		if (null == user) {
			return Promise.reject(new InternalServerError('User does not exist'));
		}

		let userTeams = Array.isArray(user.teams) ? user.teams : [];
		if (roles && roles.length > 0) {
			userTeams = userTeams.filter(
				(t) => null != t.role && roles.includes(t.role)
			);
		}

		const userTeamIds = userTeams.map((t) => t._id);

		return Promise.resolve(userTeamIds);
	}

	async getImplicitTeamIds(
		user: IUser,
		...roles: TeamRoles[]
	): Promise<Types.ObjectId[]> {
		// Validate the user input
		// This check shouldn't be need once strictNullChecks is enabled
		if (null == user) {
			return Promise.reject(new InternalServerError('User does not exist'));
		}

		const implicitMembersEnabled = config.get<boolean>(
			'teams.implicitMembers.enabled'
		);
		const strategy = config.get<string>('teams.implicitMembers.strategy');

		if (
			!implicitMembersEnabled ||
			(roles.length > 0 && !roles.includes(TeamRoleImplicit))
		) {
			return Promise.resolve([]);
		}

		const query: FilterQuery<TeamDocument> = {
			$and: [{ implicitMembers: true }]
		};
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

		const rolesToExclude: TeamRoles[] = Object.entries(TeamRolePriorities)
			.filter(([, priority]) => priority < TeamRolePriorities[TeamRoleImplicit])
			.map(([role]) => role as TeamRoles);

		const excludedTeamIds = await this.getExplicitTeamIds(
			user,
			...rolesToExclude
		);
		if (excludedTeamIds.length > 0) {
			query.$and.push({
				_id: { $nin: excludedTeamIds }
			});
		}

		return this.model.distinct<'_id', Types.ObjectId>('_id', query).exec();
	}

	getNestedTeamIds(teamIds: Types.ObjectId[] = []): Promise<Types.ObjectId[]> {
		const nestedTeamsEnabled = config.get<boolean>('teams.nestedTeams');
		if (!nestedTeamsEnabled || teamIds.length === 0) {
			return Promise.resolve([]);
		}

		return this.model
			.distinct<'_id', Types.ObjectId>('_id', {
				_id: { $nin: teamIds },
				ancestors: { $in: teamIds }
			})
			.exec();
	}

	async getTeamIds(
		user: IUser,
		...roles: TeamRoles[]
	): Promise<Types.ObjectId[]> {
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
	 * Constrain a set of teamIds provided by the user to those the user actually has access to.
	 */
	async filterTeamIds(
		user: UserDocument,
		teamIds: Types.ObjectId[] = []
	): Promise<Types.ObjectId[]> {
		const memberTeamIds = await this.getTeamIds(
			user,
			...this.getRoles(TeamRoleMinimumWithAccess)
		);

		// If there were no teamIds to filter by, return all the team ids
		if (null == teamIds || (Array.isArray(teamIds) && teamIds.length === 0)) {
			return memberTeamIds;
		}
		// Else, return the intersection of the two
		return _.intersectionWith(memberTeamIds, teamIds, isObjectIdEqual);
	}

	async updateTeams(user: IUser) {
		const strategy = config.get('teams.implicitMembers.strategy');
		const nestedTeamsEnabled = config.get<boolean>('teams.nestedTeams');

		if (strategy === 'disabled' && !nestedTeamsEnabled) {
			return;
		}

		const teamIdsByRole = await Promise.all(
			Object.values(TeamRoles).map(async (role) => {
				return {
					role,
					priority: TeamRolePriorities[role],
					teamIds: await this.getTeamIds(user, role)
				};
			})
		);

		const getHigherPriorityIds = (targetPriority: number) =>
			teamIdsByRole
				.filter(({ priority }) => priority > targetPriority)
				.flatMap(({ teamIds }) => teamIds);

		user.teams = teamIdsByRole.flatMap(({ role, priority, teamIds }) => {
			const excludeIds = getHigherPriorityIds(priority);
			return _.differenceWith(teamIds, excludeIds, isObjectIdEqual).map(
				(id) => ({
					role: role,
					_id: id
				})
			);
		});
	}

	getRoles(minPriorityRole: TeamRoles) {
		return Object.values(TeamRoles).filter(
			(role) => TeamRolePriorities[role] >= TeamRolePriorities[minPriorityRole]
		);
	}
}

export = new TeamsService(Team, User);
