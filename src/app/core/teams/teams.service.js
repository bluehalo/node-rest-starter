'use strict';

const
	q = require('q'),
	_ = require('lodash'),
	mongoose = require('mongoose'),

	deps = require('../../../dependencies'),
	config = deps.config,
	dbs = deps.dbs,
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
	function copyTeamMutableFields(dest, src) {
		dest.name = src.name;
		dest.description = src.description;
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
	function meetsRequiredExternalTeams(user, team) {
		if(true === user.bypassAccessCheck) {
			return true;
		} else {
			// Check the required external teams against the user's externalGroups
			return _.intersection(team.requiresExternalTeams, user.externalGroups).length > 0;
		}
	}

	function meetsRoleRequirement(user, team, role) {
		// Check role of the user in this team
		let userRole = getActiveTeamRole(user, team);
		if (null != userRole && meetsOrExceedsRole(userRole, role)) {
			return q();
		}
		else {
			return q.reject({ status: 403, type: 'missing-roles', message: 'The user does not have the required roles for the team' });
		}
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
		// No matter what, we need to get these
		let teamRole = getTeamRole(user, team);

		let proxyPkiMode = config.auth.strategy === 'proxy-pki';
		let teamHasRequirements = (_.isArray(team.requiresExternalTeams) && team.requiresExternalTeams.length > 0);

		// If we are in proxy-pki mode and the team has external requirements
		if(proxyPkiMode && teamHasRequirements) {

			// If the user is active
			if(meetsRequiredExternalTeams(user, team)) {
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
	function verifyNoResourcesInTeam(team) {
		return Resource.find({ 'owner.type': 'team', 'owner._id': team._id } ).exec().then((resources) => {
			if (null != resources && resources.length > 0) {
				return q.reject({ status: 400, type: 'bad-request', message: 'There are still resources in this group.'});
			}
			return q();
		});
	}

	/**
	 * Checks if the member is the last admin of the team
	 *
	 * @param user The user object of interest
	 * @param team The team object of interest
	 * @returns {Promise} Returns a promise that resolves if the user is not the last admin, and rejects otherwise
	 */
	function verifyNotLastAdmin(user, team) {
		// Search for all users who have the admin role set to true
		return TeamMember.find({
				_id: { $ne: user._id },
				teams: { $elemMatch: { _id: team._id, role: 'admin' } }
			})
			.exec()
			.then(function(results) {
				// Just need to make sure we find one active admin who isn't this user
				let adminFound = results.some(function(u) {
					let role = getActiveTeamRole(u, team);
					return (null != role && role === 'admin');
				});

				if(adminFound) {
					return q();
				}
				else {
					return q.reject({ status: 400, type: 'bad-request', message: 'Team must have at least one admin' });
				}
			});
	}

	/**
	 * Validates that the roles are one of the accepted values
	 */
	function validateTeamRole(role) {
		if (-1 !== teamRoles.indexOf(role)) {
			return q();
		}
		else {
			return q.reject({ status: 400, type: 'bad-argument', message: 'Team role does not exist' });
		}
	}

	/**
	 * Creates a new team with the requested metadata
	 *
	 * @param teamInfo
	 * @param creator The user requesting the create
	 * @returns {Promise} Returns a promise that resolves if team is successfully created, and rejects otherwise
	 */
	function createTeam(teamInfo, creator, firstAdmin, headers) {
		// Create the new team model
		let newTeam = new Team(teamInfo);

		// Write the auto-generated metadata
		newTeam.creator = creator;
		newTeam.created = Date.now();
		newTeam.updated = Date.now();
		newTeam.creatorName = creator.name;

		return User.findById(firstAdmin).exec().then((user) => {
			user = User.filteredCopy(user);
			// Audit the creation action
			return auditService.audit('team created', 'team', 'create', TeamMember.auditCopy(creator), Team.auditCopy(newTeam), headers).then(function () {
				// Save the new team
				return newTeam.save();
			}).then(function (team) {
				// Add first admin as first team member with admin role, or the creator if null
				return addMemberToTeam(user || creator, team, 'admin', creator);
			});
		});
	}

	function getTeams(queryParams) {
		const page = util.getPage(queryParams);
		const limit = util.getLimit(queryParams, 1000);

		const offset = page * limit;

		// Default to sorting by ID
		let sortArr = [{property: '_id', direction: 'DESC'}];
		if (null != queryParams.sort && null != queryParams.dir) {
			sortArr = [{property: queryParams.sort, direction: queryParams.dir}];
		}

		return Team.search({}, null, limit, offset, sortArr).then((result) => {
			return q({
				totalSize: result.count,
				pageNumber: page,
				pageSize: limit,
				totalPages: Math.ceil(result.count / limit),
				elements: result.results
			});
		});
	}

	/**
	 * Updates an existing team with fresh metadata
	 *
	 * @param team The team object to update
	 * @param updatedTeam
	 * @param user The user requesting the update
	 * @returns {Promise} Returns a promise that resolves if team is successfully updated, and rejects otherwise
	 */
	function updateTeam(team, updatedTeam, user, headers) {
		// Make a copy of the original team for auditing purposes
		let originalTeam = Team.auditCopy(team);

		// Update the updated date
		team.updated = Date.now();

		// Copy in the fields that can be changed by the user
		copyTeamMutableFields(team, updatedTeam);

		// Audit the update action
		return auditService.audit('team updated', 'team', 'update', TeamMember.auditCopy(user), { before: originalTeam, after: Team.auditCopy(team) }, headers).then(function() {
				// Save the updated team
				return team.save();
			});

	}

	/**
	 * Deletes an existing team, after verifying that team contains no more resources.
	 *
	 * @param team The team object to delete
	 * @param user The user requesting the delete
	 * @returns {Promise} Returns a promise that resolves if team is successfully deleted, and rejects otherwise
	 */
	function deleteTeam(team, user, headers) {
		return verifyNoResourcesInTeam(team).then(() => {
			// Audit the team delete attempt
			return auditService.audit('team deleted', 'team', 'delete', TeamMember.auditCopy(user), Team.auditCopy(team), headers);
		}).then(() => {
			// Delete the team and update all members in the team
			return q.allSettled([
				team.remove(),
				TeamMember.update(
					{'teams._id': team._id },
					{ $pull: { teams: { _id: team._id } } }
				)
			]);
		});
	}

	function searchTeams(search, query, queryParams, user) {
		let page = util.getPage(queryParams);
		let limit = util.getLimit(queryParams, 1000);

		let offset = page * limit;

		// Default to sorting by ID
		let sortArr = [{property: '_id', direction: 'DESC'}];
		if (null != queryParams.sort && null != queryParams.dir) {
			sortArr = [{property: queryParams.sort, direction: queryParams.dir}];
		}

		return q()
			.then(function() {
				// If user is not an admin, constrain the results to the user's teams
				if (null == user.roles || !user.roles.admin) {
					let userObj = user.toObject();
					let userTeams = [];

					if (null != userObj.teams && _.isArray(userObj.teams)) {
						// Get list of user's teams by id
						userTeams = userObj.teams.filter((t) => t.role !== 'requester').map((t) => t._id.toString());
					}

					// If the query already has a filter by team, take the intersection
					if (null != query._id && null != query._id.$in) {
						userTeams = userTeams.filter((t) => query._id.$in.indexOf(t) > -1);
					}

					// If no remaining teams, return no results
					if (userTeams.length === 0) {
						return q();
					}
					else {
						query._id = {
							$in: userTeams
						};
					}
				}

				return Team.search(query, search, limit, offset, sortArr);
			})
			.then(function(result) {
				if (null == result) {
					return q({
						totalSize: 0,
						pageNumber: 0,
						pageSize: limit,
						totalPages: 0,
						elements: []
					});
				}
				else {
					return q({
						totalSize: result.count,
						pageNumber: page,
						pageSize: limit,
						totalPages: Math.ceil(result.count / limit),
						elements: result.results
					});
				}
			});
	}

	function searchTeamMembers(search, query, queryParams, team) {
		let page = util.getPage(queryParams);
		let limit = util.getLimit(queryParams);

		let offset = page * limit;

		// Default to sorting by ID
		let sortArr = [{property: '_id', direction: 'DESC'}];
		if (null != queryParams.sort && null != queryParams.dir) {
			sortArr = [{property: queryParams.sort, direction: queryParams.dir}];
		}

		return q()
			.then(function() {
				// Inject the team query parameters
				// Finds members explicitly added to the team using the id OR
				// members implicitly added by having the externalGroup required by requiresExternalTeam
				query = query || {};
				query.$or = [
					{'teams._id': team._id},
					{'externalGroups': {$in: (_.isArray(team.requiresExternalTeams)) ? team.requiresExternalTeams : []}}
				];

				return TeamMember.search(query, search, limit, offset, sortArr);
			})
			.then(function(result) {
				// Success
				// Create the return copy of the users
				let members = [];
				result.results.forEach((element) => {
					members.push(TeamMember.teamCopy(element, team._id));
				});

				return q({
					totalSize: result.count,
					pageNumber: page,
					pageSize: limit,
					totalPages: Math.ceil(result.count/limit),
					elements: members
				});
			});
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
	function addMemberToTeam(user, team, role, requester, headers) {
		// Audit the member add request
		return auditService.audit(`team ${role} added`, 'team-role', 'user add', TeamMember.auditCopy(requester), Team.auditCopyTeamMember(team, user, role), headers).then(() => {
			return TeamMember.update({ _id: user._id }, { $addToSet: { teams: new TeamRole({ _id: team._id, role: role }) } }).exec();
		});
	}

	const addMembersToTeam = async (users, team, requester, headers) => {
		users = users || [];
		users = users.filter((user) => null != user._id);

		return await Promise.all(users.map(async (u) => {
			const user = await TeamMember.findOne({_id: u._id});
			if (null != user) {
				return await addMemberToTeam(user, team, u.role, requester, headers);
			}
		}));
	};

	function updateMemberRole(user, team, role, requester, headers) {
		let currentRole = getTeamRole(user, team);
		let updateRolePromise = (null != currentRole && currentRole === 'admin') ? verifyNotLastAdmin(user, team) : q();

		return updateRolePromise
			.then(function() {
				return validateTeamRole(role);
			})
			.then(function() {
				// Audit the member update request
				return auditService.audit(`team role changed to ${role}`, 'team-role', 'user add', TeamMember.auditCopy(requester), Team.auditCopyTeamMember(team, user, role), headers);
			})
			.then(function() {
				return TeamMember.findOneAndUpdate({ _id: user._id, 'teams._id': team._id }, { $set: { 'teams.$.role': role } }).exec();
			});
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
	function removeMemberFromTeam(user, team, requester, headers) {
		// Verify the user is not the last admin in the team
		return verifyNotLastAdmin(user, team)
			.then(function () {
				// Audit the user remove
				return auditService.audit('team member removed', 'team-role', 'user remove', TeamMember.auditCopy(requester), Team.auditCopyTeamMember(team, user, ''), headers);
			})
			.then(function () {
				// Apply the update
				return TeamMember.update({_id: user._id}, {$pull: {teams: {_id: team._id}}}).exec();
			});
	}

	function buildEmailContent(requester, team) {
		let emailData = {
			teamName: team.name,
			name: requester.name,
			username: requester.username,
			url: `${config.app.clientUrl}/team/${team._id}`
		};

		return emailService.buildEmailContent('src/app/core/teams/templates/user-request-access-email.view.html', emailData);
	}

	function sendRequestEmail(toEmail, requester, team) {
		return buildEmailContent(requester, team).then((content) => {
			let mailOptions = {
				bcc: toEmail,
				from: config.mailer.from,
				replyTo: config.mailer.from,
				subject: emailService.getSubject(`${config.app.title}: A user has requested access to Team ${team.name}`),
				html: content
			};

			return emailService.sendMail(mailOptions);
		});
	}

	function requestAccessToTeam(requester, team, headers) {
		let adminEmails;

		// Lookup the emails of all team admins
		return TeamMember.find({ teams: { $elemMatch: { _id: mongoose.Types.ObjectId(team._id), role: 'admin' } }}).then((admins) => {
			if (null == admins) {
				return q.reject({ status: 404, message: 'Error retrieving team admins' });
			}

			adminEmails = admins.map((admin) => admin.email);

			if (null == adminEmails || adminEmails.length === 0) {
				return q.reject({ status: 404, message: 'Error retrieving team admins' });
			}

			// Add requester role to user for this team
			return addMemberToTeam(requester, team, 'requester', requester, headers);
		}).then(() => {
			return sendRequestEmail(adminEmails, requester, team);
		});
	}


	function buildNewTeamEmailContent(requester, org, aoi, description) {
		let emailData = {
			org: org,
			aoi: aoi,
			description: description,
			name: requester.name,
			username: requester.username,
			url: `${config.app.clientUrl}/team/create`
		};

		return emailService.buildEmailContent('src/app/core/teams/templates/user-request-new-team-email.view.html', emailData);
	}

	function requestNewTeam(org, aoi, description, requester, headers) {
		if (null == org) {
			return q.reject({ status: 400, message: 'Organization cannot be empty' });
		}
		if (null == aoi) {
			return q.reject({ status: 400, message: 'AOI cannot be empty' });
		}
		if (null == description) {
			return q.reject({ status: 400, message: 'Description cannot be empty' });
		}
		if (null == requester) {
			return q.reject({ status: 400, message: 'Invalid requester' });
		}

		return auditService.audit('new team requested', 'team', 'request', TeamMember.auditCopy(requester), { org, aoi, description }, headers).then(() => {
			return buildNewTeamEmailContent(requester, org, aoi, description);
		}).then((content) => {
			return emailService.sendMail({
				bcc: config.contactEmail,
				from: config.mailer.from,
				replyTo: config.mailer.from,
				subject: emailService.getSubject('New Team Requested'),
				html: content
			});
		});
	}

	return {
		createTeam: createTeam,
		getTeams: getTeams,
		updateTeam: updateTeam,
		deleteTeam: deleteTeam,
		searchTeams: searchTeams,
		searchTeamMembers: searchTeamMembers,
		meetsOrExceedsRole: meetsOrExceedsRole,
		meetsRoleRequirement: meetsRoleRequirement,
		meetsRequiredExternalTeams: meetsRequiredExternalTeams,
		getActiveTeamRole: getActiveTeamRole,
		requestNewTeam: requestNewTeam,
		requestAccessToTeam: requestAccessToTeam,
		addMemberToTeam: addMemberToTeam,
		addMembersToTeam: addMembersToTeam,
		updateMemberRole: updateMemberRole,
		removeMemberFromTeam: removeMemberFromTeam
	};
};
