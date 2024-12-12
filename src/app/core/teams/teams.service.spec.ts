import assert from 'node:assert/strict';

import _ from 'lodash';
import mongoose from 'mongoose';
import { assert as sinonAssert, createSandbox, SinonSandbox } from 'sinon';

import { TeamRoles } from './team-role.model';
import { ITeam, Team, TeamDocument } from './team.model';
import teamsService from './teams.service';
import { auditService, config, emailService } from '../../../dependencies';
import { logger } from '../../../lib/logger';
import {
	BadRequestError,
	ForbiddenError,
	InternalServerError
} from '../../common/errors';
import { IUser, User, UserDocument } from '../user/user.model';
import userService from '../user/user.service';

/**
 * Helpers
 */
function clearDatabase() {
	return Promise.all([Team.deleteMany({}).exec(), User.deleteMany({}).exec()]);
}

function userSpec(key: string): Partial<IUser> {
	return new User({
		name: `${key} Name`,
		email: `${key}@email.domain`,
		username: `${key}_username`,
		organization: `${key} Organization`
	});
}

function proxyPkiUserSpec(key: string) {
	const spec = userSpec(key);
	spec.provider = 'proxy-pki';
	spec.providerData = {
		dn: key,
		dnLower: key.toLowerCase()
	};
	return spec;
}

function localUserSpec(key: string) {
	const spec = userSpec(key);
	spec.provider = 'local';
	spec.password = 'password';
	return spec;
}

function teamSpec(key: string): Partial<ITeam> {
	return {
		name: key,
		description: `${key} Team Description`
	};
}

/**
 * Unit tests
 */
describe('Team Service:', () => {
	// Specs for tests
	const spec: {
		team: Record<string, Partial<ITeam>>;
		nestedTeam: Record<string, Partial<ITeam>>;
		user: Record<string, Partial<IUser>>;
		userTeams: Record<string, { team: string; role: string }[]>;
	} = {
		team: {},
		nestedTeam: {},
		user: {},
		userTeams: {}
	};

	// Teams for tests
	spec.team.teamWithExternalTeam = teamSpec('external-team');
	spec.team.teamWithExternalTeam.implicitMembers = true;
	spec.team.teamWithExternalTeam.requiresExternalTeams = ['external-group'];

	spec.team.teamWithExternalRoles = teamSpec('external-roles');
	spec.team.teamWithExternalRoles.implicitMembers = true;
	spec.team.teamWithExternalRoles.requiresExternalRoles = ['external-role'];

	spec.team.teamWithExternalRoles2 = teamSpec('external-roles-2');
	spec.team.teamWithExternalRoles2.implicitMembers = true;
	spec.team.teamWithExternalRoles2.requiresExternalRoles = ['external-role-2'];

	spec.team.teamWithNoExternalTeam = teamSpec('no-external');
	spec.team.teamWithNoExternalTeam.requiresExternalTeams = [];

	spec.team.teamWithNoExternalTeam2 = teamSpec('no-external-2');
	spec.team.teamWithNoExternalTeam2.requiresExternalTeams = [];

	spec.team.teamWithNullRequiredExternalRoles = teamSpec('req-roles-null');
	spec.team.teamWithNullRequiredExternalRoles.requiresExternalRoles = null;

	// User implicit added to team by having an external group
	spec.user.implicit1 = proxyPkiUserSpec('implicit1');
	spec.user.implicit1.externalGroups = ['external-group', 'external-group-2'];

	// User implicit added to team by having an external role
	spec.user.implicit2 = proxyPkiUserSpec('implicit2');
	spec.user.implicit2.externalRoles = ['external-role', 'external-role-2'];

	// User explicitly added to a group.  Group is added in before() block below
	spec.user.explicit = proxyPkiUserSpec('explicit');
	spec.userTeams.explicit = [
		{ team: 'teamWithNoExternalTeam', role: TeamRoles.Member }
	];

	// Generic test users
	spec.user.user1 = localUserSpec('user1');
	spec.user.user1.roles = { user: true };
	spec.userTeams.user1 = [
		{ team: 'teamWithNoExternalTeam', role: TeamRoles.Member },
		{ team: 'teamWithNoExternalTeam2', role: TeamRoles.Member }
	];

	spec.user.user2 = localUserSpec('user2');

	spec.user.user3 = localUserSpec('user3');
	spec.user.user3.roles = { user: true };
	spec.userTeams.user3 = [
		{ team: 'teamWithNoExternalTeam', role: TeamRoles.Admin }
	];

	spec.user.admin = localUserSpec(TeamRoles.Admin);
	spec.user.admin.roles = { user: true, admin: true };

	spec.user.blocked = localUserSpec('blocked');
	spec.user.blocked.roles = { user: true };
	spec.user.blocked.externalRoles = ['external-role-2'];
	spec.userTeams.blocked = [
		{ team: 'teamWithExternalRoles2', role: 'blocked' }
	];

	let user: Record<string, UserDocument> = {};
	let team: Record<string, TeamDocument> = {};

	let sandbox: SinonSandbox;

	beforeEach(async () => {
		sandbox = createSandbox();
		sandbox.stub(auditService, 'audit').resolves();

		await clearDatabase();

		user = {};
		team = {};

		// Create the teams
		await Promise.all(
			_.keys(spec.team).map(async (key) => {
				team[key] = await new Team(spec.team[key]).save();
			})
		);

		// Create the users
		await Promise.all(
			_.keys(spec.user).map(async (key) => {
				user[key] = await new User(spec.user[key]).save();
			})
		);

		// Add users to teams
		await Promise.all(
			_.keys(spec.userTeams).map(async (k) => {
				user[k] = await User.findOneAndUpdate(
					{ _id: user[k]._id },
					{
						$set: {
							teams: spec.userTeams[k].map((ut) => ({
								_id: team[ut.team],
								role: ut.role
							}))
						}
					},
					{ new: true }
				).exec();
			})
		);
	});

	afterEach(() => {
		sandbox.restore();
		return clearDatabase();
	});

	describe('getActiveTeamRole', () => {
		it('return existing explicit team role for user (model object)', () => {
			const role = teamsService.getActiveTeamRole(
				user.explicit,
				team.teamWithNoExternalTeam
			);

			assert(role);
			assert.equal(role, TeamRoles.Member);
		});

		it('return existing explicit team role for user (plain object)', () => {
			const role = teamsService.getActiveTeamRole(
				user.explicit,
				team.teamWithNoExternalTeam
			);

			assert(role);
			assert.equal(role, TeamRoles.Member);
		});

		it('return null role for user not in team', () => {
			const role = teamsService.getActiveTeamRole(
				user.implicit1,
				team.teamWithExternalTeam
			);

			assert.equal(role, null);
		});

		describe('implicitMembers.strategy = "teams"', () => {
			beforeEach(() => {
				const configGetStub = sandbox.stub(config, 'get');
				configGetStub.withArgs('teams.implicitMembers.enabled').returns(true);
				configGetStub
					.withArgs('teams.implicitMembers.strategy')
					.returns('teams');
				configGetStub.callThrough();
			});

			it('return implicit team role for user', () => {
				const role = teamsService.getActiveTeamRole(
					user.implicit1,
					team.teamWithExternalTeam
				);

				assert(role);
				assert.equal(role, TeamRoles.Member);
			});
		});

		describe('implicitMembers.strategy = "roles"', () => {
			beforeEach(() => {
				const configGetStub = sandbox.stub(config, 'get');
				configGetStub.withArgs('teams.implicitMembers.enabled').returns(true);
				configGetStub
					.withArgs('teams.implicitMembers.strategy')
					.returns('roles');
				configGetStub.callThrough();
			});

			it('return null role for user not implicitly in team', () => {
				const role = teamsService.getActiveTeamRole(
					user.implicit1,
					team.teamWithExternalTeam
				);

				assert.equal(role, null);
			});

			it('return implicit team role for user', () => {
				const role = teamsService.getActiveTeamRole(
					user.implicit2,
					team.teamWithExternalRoles
				);

				assert(role);
				assert.equal(role, TeamRoles.Member);
			});

			it('return blocked role for user blocked from team that they would otherwise be an implicit member', () => {
				const role = teamsService.getActiveTeamRole(
					user.blocked,
					team.teamWithExternalRoles2
				);

				assert(role);
				assert.equal(role, 'blocked');
			});
		});
	});

	describe('meetsRoleRequirement', () => {
		it('should not reject for user with specified role in team', async () => {
			await assert.doesNotReject(
				teamsService.meetsRoleRequirement(
					user.explicit,
					team.teamWithNoExternalTeam,
					TeamRoles.Member
				)
			);
		});

		it('should reject for user without specified role in team', async () => {
			await assert.rejects(
				teamsService.meetsRoleRequirement(
					user.explicit,
					team.teamWithNoExternalTeam,
					TeamRoles.Admin
				),
				new ForbiddenError(
					'The user does not have the required roles for the team'
				)
			);
		});
	});

	describe('read', () => {
		it('read finds team', async () => {
			const t = await teamsService.read(team.teamWithNoExternalTeam._id);
			assert(t);
			assert.equal(t.name, 'no-external');
		});

		it('read returns null when no team found', async () => {
			const t = await teamsService.read('123412341234123412341234');
			assert.equal(t, null);
		});
	});

	describe('readTeamMember', () => {
		it('read finds team', async () => {
			const t = await userService.read(user.admin._id);
			assert(t);
			assert.equal(t.name, 'admin Name');
		});

		it('read returns null when no team found', async () => {
			const t = await userService.read(
				new mongoose.Types.ObjectId('123412341234123412341234')
			);
			assert.equal(t, null);
		});
	});

	describe('create', () => {
		it('explicit admin should be used', async () => {
			const queryParams = { dir: 'ASC', page: '0', size: '5', sort: 'name' };
			const creator = await User.findOne({ name: 'user1 Name' }).exec();
			const admin = await User.findOne({ name: 'user2 Name' }).exec();

			await teamsService.create(teamSpec('test-create-2'), creator, admin._id);
			const _team = await Team.findOne({ name: 'test-create-2' }).exec();
			const { elements } = await userService.searchUsers(
				queryParams,
				{ 'teams._id': _team._id },
				null
			);
			assert(Array.isArray(elements), 'elements should be an Array');
			assert.equal(elements.length, 1);
			assert.equal(elements[0].name, admin.name);
		});

		it('null admin should default admin to creator', async () => {
			const queryParams = { dir: 'ASC', page: '0', size: '5', sort: 'name' };
			const creator = user.user1;

			// null admin should default to creator
			await teamsService.create(teamSpec('test-create'), creator, null);
			const _team = await Team.findOne({ name: 'test-create' }).exec();
			const { elements } = await userService.searchUsers(
				queryParams,
				{ 'teams._id': _team._id },
				null
			);
			assert(Array.isArray(elements), 'elements should be an Array');
			assert.equal(elements.length, 1);
			assert.equal(elements[0].name, creator.name);
		});

		it('nested team created', async () => {
			const creator = user.user1;

			let _team = teamSpec('nested-team');
			_team.parent = team.teamWithNoExternalTeam._id;

			await teamsService.create(_team, creator, null);
			_team = await Team.findOne({ name: 'nested-team' }).exec();

			assert(_team);
			assert.equal(typeof _team, 'object');
			assert.equal(
				_team.parent.toString(),
				team.teamWithNoExternalTeam._id.toString()
			);
			assert.equal(_team.ancestors.length, 1);
		});
	});

	describe('update', () => {
		it('should update team', async () => {
			const updates = {
				name: `${team.teamWithNoExternalTeam.name}_updated`
			};

			const updatedTeam = await teamsService.update(
				team.teamWithNoExternalTeam,
				updates
			);

			// Verify updates were applied on returned object
			assert.equal(updatedTeam.name, updates.name);

			// Verify updates were applied by requerying
			const t = await Team.findById(team.teamWithNoExternalTeam._id);
			assert.equal(t.name, updates.name);
		});
	});

	describe('delete', () => {
		it('should delete team, if team has no resources', async () => {
			const beforeTeamCount = await Team.countDocuments({});

			await assert.doesNotReject(
				teamsService.delete(team.teamWithNoExternalTeam)
			);

			// Verify Team no longer exists
			const tResult = await Team.findById(team.teamWithNoExternalTeam._id);
			assert.equal(tResult, null);

			// Verify only one team was deleted
			const afterTeamCount = await Team.countDocuments({});
			assert.equal(afterTeamCount, beforeTeamCount - 1);

			// Verify team entry is removed from user
			const count = await User.countDocuments({
				'teams._id': team.teamWithNoExternalTeam._id
			});
			assert.equal(count, 0);
		});

		it('should reject if team has resources', async () => {
			sandbox.stub(teamsService, 'getResourceCount').resolves(1);

			await assert.rejects(
				teamsService.delete(team.teamWithNoExternalTeam),
				new BadRequestError('There are still resources in this team.')
			);

			// Verify team still exists
			const result = await Team.findById(team.teamWithNoExternalTeam._id);
			assert(result);

			// Verify team entry is not removed from user
			const uResult = await User.findById(user.explicit._id);
			const userTeam = uResult.teams.find((t) =>
				t._id.equals(team.teamWithNoExternalTeam._id)
			);
			assert(userTeam);
		});
	});

	describe('search', () => {
		beforeEach(async () => {
			const teams = [...Array(94).keys()].map((index) => {
				return new Team({
					name: `Name-${index}`,
					description: `Description-${index}`
				});
			});

			await Promise.all(teams.map((team) => team.save()));
		});

		it('empty search results page returned', async () => {
			const queryParams = { size: 10 };
			const query = {};
			const search = '';
			const { elements, ...result } = await teamsService.search(
				queryParams,
				query,
				search,
				user.user2
			);

			assert.deepStrictEqual(result, {
				totalSize: 0,
				pageSize: queryParams.size,
				pageNumber: 0,
				totalPages: 0
			});
			assert(Array.isArray(elements), 'elements should be an Array');
			assert.equal(elements.length, 0);
		});

		it('search results page returned', async () => {
			const queryParams = { size: 10 };
			const query = {};
			const search = '';
			const { elements, ...result } = await teamsService.search(
				queryParams,
				query,
				search,
				user.admin
			);

			assert.deepStrictEqual(result, {
				totalSize: 100,
				pageSize: queryParams.size,
				pageNumber: 0,
				totalPages: 10
			});
			assert(Array.isArray(elements), 'elements should be an Array');
			assert.equal(elements.length, queryParams.size);
		});

		it('filtered search results page returned', async () => {
			const queryParams = { size: 10 };
			const query = { _id: { $in: [team.teamWithNoExternalTeam._id] } };
			const search = '';
			const { elements, ...result } = await teamsService.search(
				queryParams,
				query,
				search,
				user.user1
			);

			assert.deepStrictEqual(result, {
				totalSize: 1,
				pageSize: queryParams.size,
				pageNumber: 0,
				totalPages: 1
			});
			assert(Array.isArray(elements), 'elements should be an Array');
			assert.equal(elements.length, 1);
		});

		it('check isMember field', async () => {
			const queryParams = { size: 100 };
			const query = {};
			const search = '';
			const { elements, ...result } = await teamsService.search(
				queryParams,
				query,
				search,
				user.user1
			);

			assert.deepStrictEqual(result, {
				totalSize: 2,
				pageSize: queryParams.size,
				pageNumber: 0,
				totalPages: 1
			});
			assert(Array.isArray(elements), 'elements should be an Array');
			assert.equal(elements.length, 2);

			const isMemberResults = (
				elements as unknown as Array<
					TeamDocument & {
						isMember: boolean;
					}
				>
			)
				.filter((element) => element.isMember)
				.map((team) => team.name);

			// user 1 is only members of these two teams (defined by user setup above)
			assert.equal(isMemberResults.length, 2);
			assert.equal(isMemberResults[0], team.teamWithNoExternalTeam2.name);
			assert.equal(isMemberResults[1], team.teamWithNoExternalTeam.name);

			const result2 = await teamsService.search(
				queryParams,
				query,
				search,
				user.user3
			);

			assert.deepStrictEqual(result, {
				totalSize: 2,
				pageSize: queryParams.size,
				pageNumber: 0,
				totalPages: 1
			});
			assert(Array.isArray(elements), 'elements should be an Array');
			assert.equal(elements.length, 2);

			const isMemberResults2 = (
				result2.elements as unknown as Array<
					TeamDocument & {
						isMember: boolean;
					}
				>
			)
				.filter((element) => element.isMember)
				.map((team) => team.name);

			// user 3 is only members of one of these teams (defined by user setup above)
			assert.equal(isMemberResults2.length, 1);
			assert.equal(isMemberResults2[0], team.teamWithNoExternalTeam.name);
		});
	});

	describe('addMemberToTeam', () => {
		it('adds user to team', async () => {
			await teamsService.addMemberToTeam(
				user.user1,
				team.teamWithNoExternalTeam,
				TeamRoles.Member
			);

			const uResult = await User.findById(user.user1);
			const userTeam = uResult.teams.find((t) =>
				t._id.equals(team.teamWithNoExternalTeam._id)
			);
			assert(userTeam);
			assert.equal(userTeam.role, TeamRoles.Member);
		});
	});

	describe('updateMemberRole', () => {
		it('update role', async () => {
			await teamsService.updateMemberRole(
				user.explicit,
				team.teamWithNoExternalTeam,
				TeamRoles.Admin
			);

			const uResult = await User.findById(user.explicit._id);
			const userTeam = uResult.teams.find((t) =>
				t._id.equals(team.teamWithNoExternalTeam._id)
			);
			assert(userTeam);
			assert.equal(userTeam.role, TeamRoles.Admin);
		});

		it('downgrade admin role; succeed if team has other admins', async () => {
			await teamsService.addMemberToTeam(
				user.user2,
				team.teamWithNoExternalTeam,
				TeamRoles.Admin
			);

			await assert.doesNotReject(
				teamsService.updateMemberRole(
					user.user3,
					team.teamWithNoExternalTeam,
					TeamRoles.Member
				)
			);
		});

		it('downgrade admin role; reject if team has no other admins', async () => {
			await assert.rejects(
				teamsService.updateMemberRole(
					user.user3,
					team.teamWithNoExternalTeam,
					TeamRoles.Member
				),
				new BadRequestError('Team must have at least one admin')
			);
		});
	});

	describe('removeMemberFromTeam', () => {
		it('remove admin user; succeed if team has other admins', async () => {
			await teamsService.addMemberToTeam(
				user.user2,
				team.teamWithNoExternalTeam,
				TeamRoles.Admin
			);

			await assert.doesNotReject(
				teamsService.removeMemberFromTeam(
					user.user3,
					team.teamWithNoExternalTeam
				)
			);
		});

		it('remove admin user; reject if team has no other admins', async () => {
			await assert.rejects(
				teamsService.removeMemberFromTeam(
					user.user3,
					team.teamWithNoExternalTeam
				),
				new BadRequestError('Team must have at least one admin')
			);
		});
	});

	describe('meetsRequiredExternalTeams', () => {
		it('meetsRequiredExternalTeams', () => {
			let _user = new User({ bypassAccessCheck: true });
			let _team = new Team({});

			let match = teamsService.meetsRequiredExternalTeams(_user, _team);

			assert.equal(match, true);

			_user = new User({ bypassAccessCheck: false });
			_team = new Team({});

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			assert.equal(match, false);

			_user = new User({ bypassAccessCheck: false });
			_team = new Team({ requiresExternalTeams: ['one'] });

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			assert.equal(match, false);

			_user = new User({ bypassAccessCheck: false, externalGroups: ['two'] });
			_team = new Team({ requiresExternalTeams: ['one'] });

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			assert.equal(match, false);

			_user = new User({ bypassAccessCheck: false, externalGroups: ['one'] });
			_team = new Team({ requiresExternalTeams: ['one'] });

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			assert.equal(match, true);

			_user = new User({ bypassAccessCheck: false, externalGroups: ['two'] });
			_team = new Team({ requiresExternalTeams: ['one', 'two'] });

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			assert.equal(match, true);

			_user = new User({
				bypassAccessCheck: false,
				externalGroups: ['two', 'four']
			});
			_team = new Team({ requiresExternalTeams: ['one', 'two'] });

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			assert.equal(match, true);

			_user = new User({
				bypassAccessCheck: false,
				externalGroups: ['two', 'four']
			});
			_team = new Team({ requiresExternalTeams: ['four', 'one', 'two'] });

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			assert.equal(match, true);

			_user = new User({ bypassAccessCheck: false, externalGroups: ['two'] });
			_team = new Team({ requiresExternalTeams: [] });

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			assert.equal(match, false);
		});
	});

	describe('meetsRequiredExternalRoles', () => {
		it('meetsRequiredExternalRoles', () => {
			let _user = new User({});
			let _team = new Team({});

			let match = teamsService.meetsRequiredExternalRoles(_user, _team);

			assert.equal(match, false);

			_user = new User({});
			_team = new Team({ requiresExternalRoles: ['one'] });

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			assert.equal(match, false);

			_user = new User({ externalRoles: ['two'] });
			_team = new Team({ requiresExternalRoles: ['one'] });

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			assert.equal(match, false);

			_user = new User({ externalRoles: ['one'] });
			_team = new Team({ requiresExternalRoles: ['one'] });

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			assert.equal(match, true);

			_user = new User({ externalRoles: ['two'] });
			_team = new Team({ requiresExternalRoles: ['one', 'two'] });

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			assert.equal(match, false);

			_user = new User({ externalRoles: ['one', 'two', 'three'] });
			_team = new Team({ requiresExternalRoles: ['one', 'two'] });

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			assert.equal(match, true);

			_user = new User({ externalRoles: ['two', 'four'] });
			_team = new Team({ requiresExternalRoles: ['four', 'one', 'two'] });

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			assert.equal(match, false);

			_user = new User({ externalRoles: ['two'] });
			_team = new Team({ requiresExternalRoles: [] });

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			assert.equal(match, false);
		});
	});

	describe('isImplicitMember', () => {
		describe('strategy = roles', () => {
			beforeEach(() => {
				const configGetStub = sandbox.stub(config, 'get');
				configGetStub.withArgs('teams.implicitMembers.enabled').returns(true);
				configGetStub
					.withArgs('teams.implicitMembers.strategy')
					.returns('roles');
				configGetStub.callThrough();
			});

			it('should not match when user.externalRoles and team.requiresExternalRoles are undefined', () => {
				const _user = new User({});
				const _team = new Team({});
				const match = teamsService.isImplicitMember(_user, _team);
				assert.equal(match, false);
			});

			it('should not match when team does not have requiresExternalRoles', () => {
				const _user = new User({ externalRoles: ['one', 'two', 'three'] });
				let _team = new Team({});
				let match = teamsService.isImplicitMember(_user, _team);
				assert.equal(match, false);

				_team = new Team({ requiresExternalRoles: [] });
				match = teamsService.isImplicitMember(_user, _team);
				assert.equal(match, false);
			});

			it('should match when user has required external roles', () => {
				const _user = new User({ externalRoles: ['one', 'two', 'three'] });
				let _team = new Team({ requiresExternalRoles: ['one'] });
				let match = teamsService.isImplicitMember(_user, _team);
				assert.equal(match, true);

				_team = new Team({ requiresExternalRoles: ['one', 'two'] });
				match = teamsService.isImplicitMember(_user, _team);
				assert.equal(match, true);

				_team = new Team({ requiresExternalRoles: ['one', 'three'] });
				match = teamsService.isImplicitMember(_user, _team);
				assert.equal(match, true);
			});
		});

		describe('strategy = teams', () => {
			beforeEach(() => {
				const configGetStub = sandbox.stub(config, 'get');
				configGetStub.withArgs('teams.implicitMembers.enabled').returns(true);
				configGetStub
					.withArgs('teams.implicitMembers.strategy')
					.returns('teams');
				configGetStub.callThrough();
			});

			it('should not match when user.externalRoles and team.requiresExternalTeams are undefined', () => {
				const _user = new User({});
				const _team = new Team({});
				const match = teamsService.isImplicitMember(_user, _team);
				assert.equal(match, false);
			});

			it('should not match when team does not have requiresExternalTeams', () => {
				const _user = new User({ externalGroups: ['one', 'two', 'three'] });
				let _team = new Team({});
				let match = teamsService.isImplicitMember(_user, _team);
				assert.equal(match, false);

				_team = new Team({ requiresExternalTeams: [] });
				match = teamsService.isImplicitMember(_user, _team);
				assert.equal(match, false);
			});

			it('should match when user has required external teams', () => {
				let _user = new User({ externalGroups: ['one'] });
				const _team = new Team({
					requiresExternalTeams: ['one', 'two', 'three']
				});
				let match = teamsService.isImplicitMember(_user, _team);
				assert.equal(match, true);

				_user = new User({ externalGroups: ['two'] });
				match = teamsService.isImplicitMember(_user, _team);
				assert.equal(match, true);

				_user = new User({ externalGroups: ['three'] });
				match = teamsService.isImplicitMember(_user, _team);
				assert.equal(match, true);
			});
		});

		describe('enabled = false', () => {
			beforeEach(() => {
				const configGetStub = sandbox.stub(config, 'get');
				configGetStub.withArgs('teams.implicitMembers.enabled').returns(false);
				configGetStub.callThrough();
			});

			it('should not match any since disabled', () => {
				let _user = new User({});
				let _team = new Team({});
				let match = teamsService.isImplicitMember(_user, _team);
				assert.equal(match, false);

				_user = new User({
					externalRoles: ['one', 'two', 'three'],
					externalGroups: ['one', 'two', 'three']
				});
				match = teamsService.isImplicitMember(_user, _team);
				assert.equal(match, false);

				_team = new Team({
					requiresExternalRoles: [],
					requiresExternalGroups: []
				});
				match = teamsService.isImplicitMember(_user, _team);
				assert.equal(match, false);

				_team = new Team({ requiresExternalRoles: ['one'] });
				match = teamsService.isImplicitMember(_user, _team);
				assert.equal(match, false);

				_team = new Team({ requiresExternalRoles: ['one', 'two'] });
				match = teamsService.isImplicitMember(_user, _team);
				assert.equal(match, false);

				_team = new Team({ requiresExternalRoles: ['one', 'three'] });
				match = teamsService.isImplicitMember(_user, _team);
				assert.equal(match, false);
			});
		});
	});

	describe('sendRequestEmail', () => {
		const toEmails = ['email1@server.com', 'email2@server.com'];

		it('should create mailOptions properly', async () => {
			const sendMailStub = sandbox.stub(emailService, 'sendMail');

			const _user = new User({
				name: 'test',
				username: 'test',
				email: 'test@test.test'
			});

			const _team = new Team({
				_id: '12345',
				name: 'test team'
			});

			const expectedEmailContent = `HEADER
<p>Hey there <strong>${_team.name}</strong> Admin,</p>
<p>A user named <strong>${_user.name}</strong> with username <strong>${
				_user.username
			}</strong> has requested access to the team.</p>
<p>Click <a href="${config.get('app.clientUrl')}/team/${
				_team._id
			}">here</a> to give them access!</p>
FOOTER
`;

			await teamsService.sendRequestEmail(toEmails, _user, _team);

			sinonAssert.called(sendMailStub);
			const [mailOptions] = sendMailStub.getCall(0).args;

			assert(mailOptions, 'expected mailOptions to exist');

			assert.deepStrictEqual(mailOptions.bcc, toEmails);
			assert.equal(
				mailOptions.from,
				config.get<string>('coreEmails.default.from')
			);
			assert.equal(
				mailOptions.replyTo,
				config.get<string>('coreEmails.default.replyTo')
			);
			assert.equal(
				mailOptions.subject,
				`${config.get<string>(
					'app.title'
				)}: A user has requested access to Team ${_team.name}`
			);
			assert.equal(mailOptions.html, expectedEmailContent);
		});

		it('should fail silently and log error', async () => {
			sandbox.stub(emailService, 'sendMail').throws('error');
			const logStub = sandbox.stub(logger, 'error');

			await teamsService.sendRequestEmail(
				toEmails,
				user.user1,
				team.teamWithNoExternalTeam
			);

			sinonAssert.calledOnce(logStub);

			const [message] = logStub.getCall(0).args;

			assert.equal(message, 'Failure sending email.');
		});
	});

	describe('requestAccessToTeam', () => {
		it('should reject if no team admins are found', async () => {
			await assert.rejects(
				teamsService.requestAccessToTeam(
					user.admin,
					team.teamWithNoExternalTeam2
				),
				new InternalServerError('Error retrieving team admins')
			);

			const requesterCount = await User.countDocuments({
				teams: {
					$elemMatch: {
						_id: new mongoose.Types.ObjectId(team.teamWithNoExternalTeam2._id),
						role: 'requester'
					}
				}
			}).exec();
			assert.equal(requesterCount, 0);
		});

		it('should work', async () => {
			await assert.doesNotReject(
				teamsService.requestAccessToTeam(
					user.admin,
					team.teamWithNoExternalTeam
				)
			);
			const requesterCount = await User.countDocuments({
				teams: {
					$elemMatch: {
						_id: new mongoose.Types.ObjectId(team.teamWithNoExternalTeam._id),
						role: 'requester'
					}
				}
			}).exec();
			assert.equal(requesterCount, 1);
		});
	});

	describe('requestNewTeam', () => {
		const _user = new User({
			name: 'test',
			username: 'test',
			email: 'test@test.test'
		});

		it('should properly reject invalid parameters', async () => {
			await assert.rejects(
				teamsService.requestNewTeam(null, null, null, null),
				new BadRequestError('Organization cannot be empty')
			);

			await assert.rejects(
				teamsService.requestNewTeam('org', null, null, null),
				new BadRequestError('AOI cannot be empty')
			);

			await assert.rejects(
				teamsService.requestNewTeam('org', 'aoi', null, null),
				new BadRequestError('Description cannot be empty')
			);

			await assert.rejects(
				teamsService.requestNewTeam('org', 'aoi', 'description', null),
				new BadRequestError('Invalid requester')
			);
		});

		it('should create mailOptions properly', async () => {
			const sendMailStub = sandbox.stub(emailService, 'sendMail');

			const expectedEmailContent = `HEADER
<p>Hey there ${config.get<string>('app.title')} Admins,</p>
<p>A user named <strong>${_user.name}</strong> with username <strong>${
				_user.username
			}</strong> has requested a new team:</p>
<p>
\t<strong>Organization:</strong> org<br/>
\t<strong>AOI:</strong> aoi<br/>
\t<strong>Description:</strong> description<br/>
</p>
<p>Click <a href="${config.get(
				'app.clientUrl'
			)}/team/create">here</a> to create this team!</p>
FOOTER
`;

			await teamsService.requestNewTeam('org', 'aoi', 'description', _user);

			sinonAssert.called(sendMailStub);
			const [mailOptions] = sendMailStub.getCall(0).args;

			assert(mailOptions, 'expected mailOptions to exist');

			assert.equal(
				mailOptions.bcc,
				config.get('coreEmails.newTeamRequest.bcc')
			);
			assert.equal(
				mailOptions.from,
				config.get<string>('coreEmails.default.from')
			);
			assert.equal(
				mailOptions.replyTo,
				config.get<string>('coreEmails.default.replyTo')
			);
			assert.equal(mailOptions.subject, 'New Team Requested');
			assert.equal(mailOptions.html, expectedEmailContent);
		});

		it('should fail silently and log error', async () => {
			sandbox.stub(emailService, 'sendMail').throws('error');
			const logStub = sandbox.stub(logger, 'error');

			await teamsService.requestNewTeam(
				'org',
				'aoi',
				'description',
				user.user1
			);

			sinonAssert.calledOnce(logStub);

			const [message] = logStub.getCall(0).args;
			assert.equal(message, 'Failure sending email.');
		});
	});

	describe('getImplicitTeamIds', () => {
		describe('strategy = roles', () => {
			beforeEach(() => {
				const configGetStub = sandbox.stub(config, 'get');
				configGetStub.withArgs('teams.implicitMembers.enabled').returns(true);
				configGetStub
					.withArgs('teams.implicitMembers.strategy')
					.returns('roles');
				configGetStub.callThrough();
			});

			it('reject for non-existent user', async () => {
				await assert.rejects(
					teamsService.getImplicitTeamIds(null),
					new InternalServerError('User does not exist')
				);
			});

			it('should find implicit teams for user with matching external roles (model object)', async () => {
				const teamIds = await teamsService.getImplicitTeamIds(user.implicit2);
				assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
				assert.equal(teamIds.length, 2);
			});

			it('should find implicit teams for user with matching external roles (plain object)', async () => {
				const teamIds = await teamsService.getImplicitTeamIds(user.implicit2);
				assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
				assert.equal(teamIds.length, 2);
			});

			it('should not find implicit teams for user without matching external roles', async () => {
				const _user = await User.findOne({
					username: 'implicit1_username'
				}).exec();
				assert(_user, 'expected implicit1 to exist');
				assert.equal(_user.username, 'implicit1_username');

				const teamIds = await teamsService.getImplicitTeamIds(_user);
				assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
				assert.equal(teamIds.length, 0);
			});

			it('should not find implicit teams for user with matching external roles, but is explicitly blocked', async () => {
				const _user = await User.findOne({
					username: 'blocked_username'
				}).exec();
				assert(_user, 'expected blocked to exist');
				assert.equal(_user.username, 'blocked_username');

				const teamIds = await teamsService.getImplicitTeamIds(_user);
				assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
				assert.equal(teamIds.length, 0);
			});
		});

		describe('strategy = teams;', () => {
			beforeEach(() => {
				const configGetStub = sandbox.stub(config, 'get');
				configGetStub.withArgs('teams.implicitMembers.enabled').returns(true);
				configGetStub
					.withArgs('teams.implicitMembers.strategy')
					.returns('teams');
				configGetStub.callThrough();
			});

			it('should find implicit teams for user with matching external teams', async () => {
				const _user = await User.findOne({
					username: 'implicit1_username'
				}).exec();
				assert(_user, 'expected implicit1 to exist');
				assert.equal(_user.username, 'implicit1_username');

				const teamIds = await teamsService.getImplicitTeamIds(_user);
				assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
				assert.equal(teamIds.length, 1);
			});

			it('should not find implicit teams for user without matching external teams', async () => {
				const _user = await User.findOne({
					username: 'implicit2_username'
				}).exec();
				assert(_user, 'expected user2 to exist');
				assert.equal(_user.username, 'implicit2_username');

				const teamIds = await teamsService.getImplicitTeamIds(_user);
				assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
				assert.equal(teamIds.length, 0);
			});
		});

		describe('enabled = false;', () => {
			beforeEach(() => {
				const configGetStub = sandbox.stub(config, 'get');
				configGetStub.withArgs('teams.implicitMembers.enabled').returns(false);
				configGetStub.callThrough();
			});

			it('should not find implicit teams for users with matching external roles/teams if disabled', async () => {
				const user1 = await User.findOne({ username: 'user1_username' }).exec();
				assert(user1, 'expected user1 to exist');
				assert.equal(user1.username, 'user1_username');

				const user2 = await User.findOne({ username: 'user2_username' }).exec();
				assert(user2, 'expected user2 to exist');
				assert.equal(user2.username, 'user2_username');

				let teamIds = await teamsService.getImplicitTeamIds(user1);
				assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
				assert.equal(teamIds.length, 0);

				teamIds = await teamsService.getImplicitTeamIds(user2);
				assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
				assert.equal(teamIds.length, 0);
			});
		});
	});

	describe('Nested Teams', () => {
		beforeEach(async () => {
			spec.nestedTeam.nestedTeam1 = teamSpec('nested-team-1');
			spec.nestedTeam.nestedTeam2 = teamSpec('nested-team-2');
			spec.nestedTeam.nestedTeam3 = teamSpec('nested-team-3');
			spec.nestedTeam.nestedTeam1_1 = teamSpec('nested-team-1-1');
			spec.nestedTeam.nestedTeam1_2 = teamSpec('nested-team-1-2');
			spec.nestedTeam.nestedTeam2_1 = teamSpec('nested-team-2-1');

			// Create nested teams
			let t = new Team({
				...spec.nestedTeam.nestedTeam1,
				parent: team.teamWithNoExternalTeam._id,
				ancestors: [team.teamWithNoExternalTeam._id]
			});
			team.nestedTeam1 = await t.save();

			t = new Team({
				...spec.nestedTeam.nestedTeam2,
				parent: team.teamWithNoExternalTeam._id,
				ancestors: [team.teamWithNoExternalTeam._id]
			});
			team.nestedTeam2 = await t.save();

			t = new Team({
				...spec.nestedTeam.nestedTeam3,
				parent: team.teamWithNoExternalTeam._id,
				ancestors: [team.teamWithNoExternalTeam._id]
			});
			team.nestedTeam3 = await t.save();

			t = new Team({
				...spec.nestedTeam.nestedTeam1_1,
				parent: team.nestedTeam1._id,
				ancestors: [team.teamWithNoExternalTeam._id, team.nestedTeam1._id]
			});
			team.nestedTeam1_1 = await t.save();

			t = new Team({
				...spec.nestedTeam.nestedTeam1_2,
				parent: team.nestedTeam1._id,
				ancestors: [team.teamWithNoExternalTeam._id, team.nestedTeam1._id]
			});
			team.nestedTeam1_2 = await t.save();

			t = new Team({
				...spec.nestedTeam.nestedTeam2_1,
				parent: team.nestedTeam2._id,
				ancestors: [team.teamWithNoExternalTeam._id, team.nestedTeam2._id]
			});
			team['nestedTeam2_1'] = await t.save();
		});

		describe('getTeamRole', () => {
			it('Should get team role for root team', () => {
				const role = teamsService.getActiveTeamRole(
					user.user1,
					team.teamWithNoExternalTeam
				);
				assert.equal(role, TeamRoles.Member);
			});

			it('Should get team role for nested team when nested teams are enabled', () => {
				const configGetStub = sandbox.stub(config, 'get');
				configGetStub.withArgs('teams.nestedTeams').returns(true);
				configGetStub.callThrough();

				const role = teamsService.getActiveTeamRole(
					user.user1,
					team.nestedTeam2_1
				);
				assert.equal(role, TeamRoles.Member);
			});

			it('Should not get team role for nested team when nested teams are disabled', () => {
				const configGetStub = sandbox.stub(config, 'get');
				configGetStub.withArgs('teams.nestedTeams').returns(false);
				configGetStub.callThrough();

				const role = teamsService.getActiveTeamRole(
					user.user1,
					team.nestedTeam2_1
				);
				assert.equal(role, null);
			});

			it('Should not get team role for nested team', () => {
				const role = teamsService.getActiveTeamRole(
					user.user2,
					team.nestedTeam1
				);
				assert.equal(role, null);
			});
		});

		describe('getNestedTeamIds', () => {
			it('return empty array if nestedTeams is disabled in config', async () => {
				const configGetStub = sandbox.stub(config, 'get');
				configGetStub.withArgs('teams.nestedTeams').returns(false);
				configGetStub.callThrough();

				const nestedTeamIds = await teamsService.getNestedTeamIds([
					team.teamWithNoExternalTeam._id
				]);

				assert(
					Array.isArray(nestedTeamIds),
					'expect nestedTeamIds to be an Array'
				);
				assert.equal(nestedTeamIds.length, 0);
			});

			it('undefined parent teams', async () => {
				const configGetStub = sandbox.stub(config, 'get');
				configGetStub.withArgs('teams.nestedTeams').returns(true);
				configGetStub.callThrough();

				const nestedTeamIds = await teamsService.getNestedTeamIds();

				assert(
					Array.isArray(nestedTeamIds),
					'expect nestedTeamIds to be an Array'
				);
				assert.equal(nestedTeamIds.length, 0);
			});

			it('empty parent teams array', async () => {
				const configGetStub = sandbox.stub(config, 'get');
				configGetStub.withArgs('teams.nestedTeams').returns(true);
				configGetStub.callThrough();

				const nestedTeamIds = await teamsService.getNestedTeamIds([]);

				assert(
					Array.isArray(nestedTeamIds),
					'expect nestedTeamIds to be an Array'
				);
				assert.equal(nestedTeamIds.length, 0);
			});

			it('default/all roles', async () => {
				const configGetStub = sandbox.stub(config, 'get');
				configGetStub.withArgs('teams.nestedTeams').returns(true);
				configGetStub.callThrough();

				const nestedTeamIds = await teamsService.getNestedTeamIds([
					team.teamWithNoExternalTeam._id
				]);

				assert(
					Array.isArray(nestedTeamIds),
					'expect nestedTeamIds to be an Array'
				);
				assert.equal(nestedTeamIds.length, 6);
			});

			it('explicitly pass "member" role', async () => {
				const configGetStub = sandbox.stub(config, 'get');
				configGetStub.withArgs('teams.nestedTeams').returns(true);
				configGetStub.callThrough();

				const nestedTeamIds = await teamsService.getNestedTeamIds([
					team.nestedTeam1._id
				]);

				assert(
					Array.isArray(nestedTeamIds),
					'expect nestedTeamIds to be an Array'
				);
				assert.equal(nestedTeamIds.length, 2);
			});
		});

		describe('updateTeams', () => {
			it('implicit members disabled; nested teams disabled', async () => {
				const configGetStub = sandbox.stub(config, 'get');
				configGetStub.withArgs('teams.implicitMembers.enabled').returns(false);
				configGetStub.withArgs('teams.nestedTeams').returns(false);
				configGetStub.callThrough();

				const user = new User({
					teams: [
						{ role: TeamRoles.Member, _id: team.teamWithNoExternalTeam._id },
						{ role: 'editor', _id: team.nestedTeam1._id },
						{ role: TeamRoles.Admin, _id: team.nestedTeam2._id }
					],
					externalRoles: ['external-role']
				});
				await teamsService.updateTeams(user);

				assert.equal(user.teams.length, 3);
			});

			it('implicit members enabled; nested teams disabled', async () => {
				const configGetStub = sandbox.stub(config, 'get');
				configGetStub.withArgs('teams.implicitMembers.enabled').returns(true);
				configGetStub
					.withArgs('teams.implicitMembers.strategy')
					.returns('roles');
				configGetStub.withArgs('teams.nestedTeams').returns(false);
				configGetStub.callThrough();

				const user = new User({
					teams: [
						{ role: TeamRoles.Member, _id: team.teamWithNoExternalTeam._id },
						{ role: 'editor', _id: team.nestedTeam1._id },
						{ role: TeamRoles.Admin, _id: team.nestedTeam2._id }
					],
					externalRoles: ['external-role']
				});
				await teamsService.updateTeams(user);

				assert.equal(user.teams.length, 4);
			});

			it('implicit members disabled; nested teams enabled', async () => {
				const configGetStub = sandbox.stub(config, 'get');
				configGetStub.withArgs('teams.implicitMembers.enabled').returns(false);
				configGetStub.withArgs('teams.nestedTeams').returns(true);
				configGetStub.callThrough();

				const user = new User({
					teams: [
						{ role: TeamRoles.Member, _id: team.teamWithNoExternalTeam._id },
						{ role: 'editor', _id: team.nestedTeam1._id },
						{ role: TeamRoles.Admin, _id: team.nestedTeam2._id }
					],
					externalRoles: ['external-role']
				});
				await teamsService.updateTeams(user);

				assert.equal(user.teams.length, 7);
			});

			it('implicit members enabled; nested teams enabled', async () => {
				const configGetStub = sandbox.stub(config, 'get');
				configGetStub.withArgs('teams.implicitMembers.enabled').returns(true);
				configGetStub
					.withArgs('teams.implicitMembers.strategy')
					.returns('roles');
				configGetStub.withArgs('teams.nestedTeams').returns(true);
				configGetStub.callThrough();

				const user = new User({
					teams: [
						{ role: TeamRoles.Member, _id: team.teamWithNoExternalTeam._id },
						{ role: 'editor', _id: team.nestedTeam1._id },
						{ role: TeamRoles.Admin, _id: team.nestedTeam2._id }
					],
					externalRoles: ['external-role']
				});
				await teamsService.updateTeams(user);

				assert.equal(user.teams.length, 8);
			});
		});
	});

	describe('getExplicitTeamIds', () => {
		const _user = new User({
			teams: [
				{
					_id: '000000000000000000000001',
					role: TeamRoles.Member
				},
				{
					_id: '000000000000000000000002',
					role: TeamRoles.Member
				},
				{
					_id: '000000000000000000000003',
					role: 'editor'
				},
				{
					_id: '000000000000000000000004',
					role: TeamRoles.Admin
				},
				{
					_id: '000000000000000000000005',
					role: 'editor'
				}
			]
		});

		it('should reject for non-existent user', async () => {
			await assert.rejects(
				teamsService.getExplicitTeamIds(null),
				new InternalServerError('User does not exist')
			);
		});

		it('should return no teams for user with empty teams array', async () => {
			const teamIds = await teamsService.getExplicitTeamIds(
				new User({ teams: [] })
			);

			assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
			assert.equal(teamIds.length, 0);
		});

		it('should return no teams for user with no teams array', async () => {
			const teamIds = await teamsService.getExplicitTeamIds(new User());

			assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
			assert.equal(teamIds.length, 0);
		});

		it('should return all team ids when roles is not specified', async () => {
			const teamIds = await teamsService.getExplicitTeamIds(_user);

			assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
			assert.deepStrictEqual(
				teamIds.map((t) => t.toString()),
				_user.teams.map((t) => t._id.toString())
			);
		});

		it('should return only team ids where user is a member', async () => {
			const teamIds = await teamsService.getExplicitTeamIds(
				_user,
				TeamRoles.Member
			);

			assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
			assert.deepStrictEqual(
				teamIds.map((t) => t.toString()),
				['000000000000000000000001', '000000000000000000000002']
			);
		});

		it('should return only team ids where user is an editor', async () => {
			const teamIds = await teamsService.getExplicitTeamIds(
				_user,
				TeamRoles.Editor
			);

			assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
			assert.deepStrictEqual(
				teamIds.map((t) => t.toString()),
				['000000000000000000000003', '000000000000000000000005']
			);
		});

		it('should return only team ids where user is an admin', async () => {
			const teamIds = await teamsService.getExplicitTeamIds(
				_user,
				TeamRoles.Admin
			);

			assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
			assert.deepStrictEqual(
				teamIds.map((t) => t.toString()),
				['000000000000000000000004']
			);
		});
	});

	describe('getTeamIds', () => {
		const _user = new User({
			teams: [
				{
					_id: '000000000000000000000001',
					role: TeamRoles.Member
				},
				{
					_id: '000000000000000000000002',
					role: TeamRoles.Member
				},
				{
					_id: '000000000000000000000003',
					role: 'editor'
				},
				{
					_id: '000000000000000000000004',
					role: TeamRoles.Admin
				},
				{
					_id: '000000000000000000000005',
					role: 'editor'
				}
			]
		});

		it('should find all team members', async () => {
			const teamIds = await teamsService.getTeamIds(
				_user,
				...teamsService.getRoles(TeamRoles.Member)
			);
			assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
			assert.deepStrictEqual(
				teamIds.map((t) => t.toString()),
				[
					'000000000000000000000001',
					'000000000000000000000002',
					'000000000000000000000003',
					'000000000000000000000004',
					'000000000000000000000005'
				]
			);
		});

		it('should find all team editors', async () => {
			const teamIds = await teamsService.getTeamIds(
				_user,
				...teamsService.getRoles(TeamRoles.Editor)
			);
			assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
			assert.deepStrictEqual(
				teamIds.map((t) => t.toString()),
				[
					'000000000000000000000003',
					'000000000000000000000004',
					'000000000000000000000005'
				]
			);
		});

		it('should find all team admins', async () => {
			const teamIds = await teamsService.getTeamIds(
				_user,
				...teamsService.getRoles(TeamRoles.Admin)
			);
			assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
			assert.deepStrictEqual(
				teamIds.map((t) => t.toString()),
				['000000000000000000000004']
			);
		});

		it('should not', async () => {
			const teamIds = await teamsService.getTeamIds(
				user.blocked,
				...teamsService.getRoles(TeamRoles.Member)
			);
			assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
			assert.equal(teamIds.length, 0);
		});
	});

	describe('filterTeamIds', () => {
		const _user = new User({
			teams: [
				{
					_id: new mongoose.Types.ObjectId('000000000000000000000001'),
					role: TeamRoles.Member
				},
				{
					_id: new mongoose.Types.ObjectId('000000000000000000000002'),
					role: TeamRoles.Member
				},
				{
					_id: new mongoose.Types.ObjectId('000000000000000000000003'),
					role: 'editor'
				},
				{
					_id: new mongoose.Types.ObjectId('000000000000000000000004'),
					role: TeamRoles.Admin
				},
				{
					_id: new mongoose.Types.ObjectId('000000000000000000000005'),
					role: 'editor'
				}
			]
		});

		it('should filter teamIds for membership (basic)', async () => {
			const teamIds = await teamsService.filterTeamIds(_user, [
				new mongoose.Types.ObjectId('000000000000000000000001')
			]);
			assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
			assert.deepStrictEqual(
				teamIds.map((t) => t.toString()),
				['000000000000000000000001']
			);
		});

		it('should filter teamIds for membership (advanced)', async () => {
			const teamIds = await teamsService.filterTeamIds(_user, [
				new mongoose.Types.ObjectId('000000000000000000000001'),
				new mongoose.Types.ObjectId('000000000000000000000002')
			]);
			assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
			assert.deepStrictEqual(
				teamIds.map((t) => t.toString()),
				['000000000000000000000001', '000000000000000000000002']
			);
		});

		it('should filter teamIds for membership when no access', async () => {
			const teamIds = await teamsService.filterTeamIds(_user, [
				new mongoose.Types.ObjectId('000000000000000000000006')
			]);
			assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
			assert.equal(teamIds.length, 0);
		});

		it('should filter teamIds for membership when no filter', async () => {
			const teamIds = await teamsService.filterTeamIds(_user);
			assert(Array.isArray(teamIds), 'expect teamIds to be an Array');
			assert.deepStrictEqual(
				teamIds.map((t) => t.toString()),
				[
					'000000000000000000000001',
					'000000000000000000000002',
					'000000000000000000000003',
					'000000000000000000000004',
					'000000000000000000000005'
				]
			);
		});
	});
});
