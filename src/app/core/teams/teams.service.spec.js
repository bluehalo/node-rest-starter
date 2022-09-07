'use strict';

const _ = require('lodash'),
	should = require('should'),
	sinon = require('sinon'),
	mongoose = require('mongoose'),
	deps = require('../../../dependencies'),
	config = deps.config,
	dbs = deps.dbs,
	teamsService = require('./teams.service'),
	User = dbs.admin.model('User'),
	Resource = dbs.admin.model('Resource'),
	Team = dbs.admin.model('Team'),
	TeamMember = dbs.admin.model('TeamUser'),
	TeamRole = dbs.admin.model('TeamRole');

/**
 * Helpers
 */
function clearDatabase() {
	return Promise.all([Team.deleteMany({}).exec(), User.deleteMany({}).exec()]);
}

function userSpec(key) {
	return {
		name: `${key} Name`,
		email: `${key}@email.domain`,
		username: `${key}_username`,
		organization: `${key} Organization`
	};
}

function proxyPkiUserSpec(key) {
	const spec = userSpec(key);
	spec.provider = 'proxy-pki';
	spec.providerData = {
		dn: key,
		dnLower: key.toLowerCase()
	};
	return spec;
}

function localUserSpec(key) {
	const spec = userSpec(key);
	spec.provider = 'local';
	spec.password = 'password';
	return spec;
}

function teamSpec(key) {
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
	const spec = { team: {}, nestedTeam: {}, user: {}, userTeams: {} };

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
		{ team: 'teamWithNoExternalTeam', role: 'member' }
	];

	// Generic test users
	spec.user.user1 = localUserSpec('user1');
	spec.user.user1.roles = { user: 1 };
	spec.userTeams.user1 = [
		{ team: 'teamWithNoExternalTeam', role: 'member' },
		{ team: 'teamWithNoExternalTeam2', role: 'member' }
	];

	spec.user.user2 = localUserSpec('user2');

	spec.user.user3 = localUserSpec('user3');
	spec.user.user3.roles = { user: 1 };
	spec.userTeams.user3 = [{ team: 'teamWithNoExternalTeam', role: 'admin' }];

	spec.user.admin = localUserSpec('admin');
	spec.user.admin.roles = { user: 1, admin: 1 };

	spec.user.blocked = localUserSpec('blocked');
	spec.user.blocked.roles = { user: 1 };
	spec.user.blocked.externalRoles = ['external-role-2'];
	spec.userTeams.blocked = [
		{ team: 'teamWithExternalRoles2', role: 'blocked' }
	];

	let user = {};
	let team = {};

	let sandbox;

	beforeEach(async () => {
		sandbox = sinon.createSandbox();
		sandbox.stub(deps.auditService, 'audit').resolves();

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
				user[k] = await TeamMember.findOneAndUpdate(
					{ _id: user[k]._id },
					{
						$set: {
							teams: spec.userTeams[k].map(
								(ut) => new TeamRole({ _id: team[ut.team], role: ut.role })
							)
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

			should.exist(role);
			role.should.equal('member');
		});

		it('return existing explicit team role for user (plain object)', () => {
			const role = teamsService.getActiveTeamRole(
				user.explicit.toObject(),
				team.teamWithNoExternalTeam
			);

			should.exist(role);
			role.should.equal('member');
		});

		it('return null role for user not in team', () => {
			const role = teamsService.getActiveTeamRole(
				user.implicit1,
				team.teamWithExternalTeam
			);

			should.not.exist(role);
		});

		it('return implicit team role for user', () => {
			sandbox
				.stub(deps.config.teams, 'implicitMembers')
				.value({ strategy: 'teams' });

			const role = teamsService.getActiveTeamRole(
				user.implicit1,
				team.teamWithExternalTeam
			);

			should.exist(role);
			role.should.equal('member');
		});

		it('return null role for user not implicitly in team', () => {
			sandbox
				.stub(deps.config.teams, 'implicitMembers')
				.value({ strategy: 'roles' });

			const role = teamsService.getActiveTeamRole(
				user.implicit1,
				team.teamWithExternalTeam
			);

			should.not.exist(role);
		});

		it('return implicit team role for user', () => {
			sandbox
				.stub(deps.config.teams, 'implicitMembers')
				.value({ strategy: 'roles' });

			const role = teamsService.getActiveTeamRole(
				user.implicit2,
				team.teamWithExternalRoles
			);

			should.exist(role);
			role.should.equal('member');
		});

		it('return null role for user implicitly in team, but implicit teams disabled', () => {
			sandbox.stub(deps.config.teams, 'implicitMembers').value(undefined);

			const role = teamsService.getActiveTeamRole(
				user.implicit1,
				team.teamWithExternalTeam
			);

			should.not.exist(role);
		});

		it('return blocked role for user blocked from team that they would otherwise be an implicit member', () => {
			sandbox
				.stub(deps.config.teams, 'implicitMembers')
				.value({ strategy: 'roles' });

			const role = teamsService.getActiveTeamRole(
				user.blocked,
				team.teamWithExternalRoles2
			);

			should.exist(role);
			role.should.equal('blocked');
		});
	});

	describe('meetsRoleRequirement', () => {
		it('should not reject for user with specified role in team', async () => {
			await teamsService
				.meetsRoleRequirement(
					user.explicit,
					team.teamWithNoExternalTeam,
					'member'
				)
				.should.be.fulfilled();
		});

		it('should reject for user without specified role in team', async () => {
			await teamsService
				.meetsRoleRequirement(
					user.explicit,
					team.teamWithNoExternalTeam,
					'admin'
				)
				.should.be.rejectedWith({
					status: 403,
					type: 'missing-roles',
					message: 'The user does not have the required roles for the team'
				});
		});

		it('should reject for invalid role in team ', async () => {
			await teamsService
				.meetsRoleRequirement(
					user.explicit,
					team.teamWithNoExternalTeam,
					'invalid'
				)
				.should.be.rejectedWith({
					status: 403,
					type: 'missing-roles',
					message: 'The user does not have the required roles for the team'
				});
		});
	});

	describe('read', () => {
		it('read finds team', async () => {
			const t = await teamsService.read(team.teamWithNoExternalTeam._id);
			should.exist(t);
			t.name.should.equal('no-external');
		});

		it('read returns null when no team found', async () => {
			const t = await teamsService.read('012345678912');
			should.not.exist(t);
		});
	});

	describe('readTeamMember', () => {
		it('read finds team', async () => {
			const t = await teamsService.readTeamMember(user.admin._id);
			should.exist(t);
			t.name.should.equal('admin Name');
		});

		it('read returns null when no team found', async () => {
			const t = await teamsService.readTeamMember(
				new mongoose.Types.ObjectId('012345678912')
			);
			should.not.exist(t);
		});
	});

	describe('create', () => {
		it('explicit admin should be used', async () => {
			const queryParams = { dir: 'ASC', page: '0', size: '5', sort: 'name' };
			const creator = await User.findOne({ name: 'user1 Name' }).exec();
			const admin = await User.findOne({ name: 'user2 Name' }).exec();

			await teamsService.create(teamSpec('test-create-2'), creator, admin);
			team = await Team.findOne({ name: 'test-create-2' }).exec();
			const members = await teamsService.searchTeamMembers(
				null,
				{},
				queryParams,
				team
			);
			members.elements.should.have.length(1);
			members.elements[0].name.should.equal(admin.name);
		});

		it('null admin should default admin to creator', async () => {
			const queryParams = { dir: 'ASC', page: '0', size: '5', sort: 'name' };
			// const creator = await User.findOne({name: 'user1 Name'}).exec();
			const creator = user.user1;

			// null admin should default to creator
			await teamsService.create(teamSpec('test-create'), creator, null);
			const _team = await Team.findOne({ name: 'test-create' }).exec();
			const members = await teamsService.searchTeamMembers(
				null,
				{},
				queryParams,
				_team
			);
			members.elements.should.have.length(1);
			members.elements[0].name.should.equal(creator.name);
		});

		it('nested team created', async () => {
			const creator = user.user1;

			let _team = teamSpec('nested-team');
			_team.parent = team.teamWithNoExternalTeam._id;

			await teamsService.create(_team, creator, null);
			_team = await Team.findOne({ name: 'nested-team' }).exec();

			should.exist(_team);
			_team.should.be.Object();
			_team.parent
				.toString()
				.should.equal(team.teamWithNoExternalTeam._id.toString());
			_team.ancestors.length.should.equal(1);
		});
	});

	describe('update', () => {
		it('should update team', async () => {
			const updates = {
				name: `${team.teamWithNoExternalTeam.name}_updated`
			};

			const updatedTeam = await teamsService
				.update(team.teamWithNoExternalTeam, updates)
				.should.be.fulfilled();

			// Verify updates were applied on returned object
			updatedTeam.name.should.equal(updates.name);

			// Verify updates were applied by requerying
			const t = await Team.findById(team.teamWithNoExternalTeam._id);
			t.name.should.equal(updates.name);
		});
	});

	describe('delete', () => {
		it('should delete team, if team has no resources', async () => {
			const beforeTeamCount = await Team.count({});

			await teamsService
				.delete(team.teamWithNoExternalTeam)
				.should.be.fulfilled();

			// Verify Team no longer exists
			const tResult = await Team.findById(team.teamWithNoExternalTeam._id);
			should.not.exist(tResult);

			// Verify only one team was deleted
			const afterTeamCount = await Team.count({});
			afterTeamCount.should.equal(beforeTeamCount - 1);

			// Verify team entry is removed from user
			const count = await TeamMember.count({
				'teams._id': team.teamWithNoExternalTeam._id
			});
			count.should.equal(0);
		});

		it('should reject if team has resources', async () => {
			const resource = new Resource({
				title: 'test resource',
				description: 'this is a test resource',
				owner: {
					type: 'team',
					_id: team.teamWithNoExternalTeam._id
				}
			});
			await resource.save();

			await teamsService
				.delete(team.teamWithNoExternalTeam)
				.should.be.rejectedWith({
					status: 400,
					type: 'bad-request',
					message: 'There are still resources in this group.'
				});

			// Verify team still exists
			const result = await Team.findById(team.teamWithNoExternalTeam._id);
			should.exist(result);

			// Verify team entry is not removed from user
			const uResult = await TeamMember.findById(user.explicit._id);
			const userTeam = uResult.teams.find((t) =>
				t._id.equals(team.teamWithNoExternalTeam._id)
			);
			should.exist(userTeam);
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
			const result = await teamsService.search(
				queryParams,
				query,
				search,
				user.user2
			);

			should.exist(result);
			result.totalSize.should.equal(0);
			result.pageSize.should.equal(queryParams.size);
			result.pageNumber.should.equal(0);
			result.totalPages.should.equal(0);
			result.elements.should.be.an.Array();
			result.elements.length.should.be.equal(0);
		});

		it('search results page returned', async () => {
			const queryParams = { size: 10 };
			const query = {};
			const search = '';
			const result = await teamsService.search(
				queryParams,
				query,
				search,
				user.admin
			);

			should.exist(result);
			result.totalSize.should.equal(100);
			result.pageSize.should.equal(queryParams.size);
			result.pageNumber.should.equal(0);
			result.totalPages.should.equal(100 / queryParams.size);
			result.elements.should.be.an.Array();
			result.elements.length.should.be.equal(queryParams.size);
		});

		it('filtered search results page returned', async () => {
			const queryParams = { size: 10 };
			const query = { _id: { $in: [team.teamWithNoExternalTeam._id] } };
			const search = '';
			const result = await teamsService.search(
				queryParams,
				query,
				search,
				user.user1
			);

			should.exist(result);
			result.totalSize.should.equal(1);
			result.pageSize.should.equal(queryParams.size);
			result.pageNumber.should.equal(0);
			result.totalPages.should.equal(1);
			result.elements.should.be.an.Array();
			result.elements.length.should.be.equal(1);
		});

		it('check isMember field', async () => {
			const queryParams = { size: 100 };
			const query = {};
			const search = '';
			const result = await teamsService.search(
				queryParams,
				query,
				search,
				user.user1
			);

			should.exist(result);
			result.totalSize.should.equal(2);
			result.pageSize.should.equal(queryParams.size);
			result.pageNumber.should.equal(0);
			result.totalPages.should.equal(1);
			result.elements.should.be.an.Array();
			result.elements.length.should.be.equal(2);

			const isMemberResults = result.elements
				.filter((element) => element.isMember)
				.map((team) => team.name);

			// user 1 is only members of these two teams (defined by user setup above)
			isMemberResults.length.should.equal(2);
			isMemberResults[0].should.equal(team.teamWithNoExternalTeam2.name);
			isMemberResults[1].should.equal(team.teamWithNoExternalTeam.name);

			const result2 = await teamsService.search(
				queryParams,
				query,
				search,
				user.user3
			);

			should.exist(result2);
			result2.totalSize.should.equal(1);
			result2.pageSize.should.equal(queryParams.size);
			result2.pageNumber.should.equal(0);
			result2.totalPages.should.equal(1);
			result2.elements.should.be.an.Array();
			result2.elements.length.should.be.equal(1);

			const isMemberResults2 = result2.elements
				.filter((element) => element.isMember)
				.map((team) => team.name);

			// user 3 is only members of one of these teams (defined by user setup above)
			isMemberResults2.length.should.equal(1);
			isMemberResults2[0].should.equal(team.teamWithNoExternalTeam.name);
		});
	});

	describe('searchTeamMembers', () => {
		beforeEach(() => {
			sandbox
				.stub(deps.config.teams, 'implicitMembers')
				.value({ strategy: 'teams' });
		});

		it('user implicitly added to a team via externalGroups', async () => {
			const queryParams = { dir: 'ASC', page: '0', size: '5', sort: 'name' };

			const searchResults = await teamsService.searchTeamMembers(
				null,
				null,
				queryParams,
				team.teamWithExternalTeam
			);
			searchResults.elements.should.have.length(1);
			searchResults.elements[0].name.should.equal('implicit1 Name');
		});

		it('user implicitly added to a team via externalRoles', async () => {
			sandbox
				.stub(deps.config.teams, 'implicitMembers')
				.value({ strategy: 'roles' });

			const queryParams = { dir: 'ASC', page: '0', size: '5', sort: 'name' };

			// const _team = await Team.findOne({ name: 'external-team' }).exec();

			const searchResults = await teamsService.searchTeamMembers(
				null,
				{},
				queryParams,
				team.teamWithExternalRoles
			);
			searchResults.elements.should.have.length(1);
			searchResults.elements[0].name.should.equal('implicit2 Name');
		});

		// Test explicit team membership
		it('user explicitly added to a team through the user.teams property', async () => {
			const queryParams = { dir: 'ASC', page: '0', size: '5', sort: 'name' };

			const _team = await Team.findOne({ name: 'no-external' }).exec();

			const searchResults = await teamsService.searchTeamMembers(
				null,
				{},
				queryParams,
				_team
			);
			searchResults.elements.should.be.an.Array();
			searchResults.elements.should.have.length(3);
			searchResults.elements[0].name.should.equal('explicit Name');
		});
	});

	describe('addMemberToTeam', () => {
		it('adds user to team', async () => {
			await teamsService.addMemberToTeam(
				user.user1,
				team.teamWithNoExternalTeam,
				'member'
			);

			const uResult = await TeamMember.findById(user.user1);
			const userTeam = uResult.teams.find((t) =>
				t._id.equals(team.teamWithNoExternalTeam._id)
			);
			should.exist(userTeam);
			userTeam.role.should.equal('member');
		});
	});

	describe('updateMemberRole', () => {
		it('update role', async () => {
			await teamsService.updateMemberRole(
				user.explicit,
				team.teamWithNoExternalTeam,
				'admin'
			);

			const uResult = await TeamMember.findById(user.explicit._id);
			const userTeam = uResult.teams.find((t) =>
				t._id.equals(team.teamWithNoExternalTeam._id)
			);
			should.exist(userTeam);
			userTeam.role.should.equal('admin');
		});

		it('downgrade admin role; succeed if team has other admins', async () => {
			await teamsService.addMemberToTeam(
				user.user2,
				team.teamWithNoExternalTeam,
				'admin'
			);

			await teamsService
				.updateMemberRole(user.user3, team.teamWithNoExternalTeam, 'member')
				.should.be.fulfilled();
		});

		it('downgrade admin role; reject if team has no other admins', async () => {
			await teamsService
				.updateMemberRole(user.user3, team.teamWithNoExternalTeam, 'member')
				.should.be.rejectedWith({
					status: 400,
					type: 'bad-request',
					message: 'Team must have at least one admin'
				});
		});

		it('reject for invalid team role', async () => {
			await teamsService
				.updateMemberRole(user.user1, team.teamWithNoExternalTeam, 'fake-role')
				.should.be.rejectedWith({
					status: 400,
					type: 'bad-argument',
					message: 'Team role does not exist'
				});
		});
	});

	describe('removeMemberFromTeam', () => {
		it('remove admin user; succeed if team has other admins', async () => {
			await teamsService.addMemberToTeam(
				user.user2,
				team.teamWithNoExternalTeam,
				'admin'
			);

			await teamsService
				.removeMemberFromTeam(user.user3, team.teamWithNoExternalTeam)
				.should.be.fulfilled();
		});

		it('remove admin user; reject if team has no other admins', async () => {
			await teamsService
				.removeMemberFromTeam(user.user3, team.teamWithNoExternalTeam)
				.should.be.rejectedWith({
					status: 400,
					type: 'bad-request',
					message: 'Team must have at least one admin'
				});
		});
	});

	describe('meetsRequiredExternalTeams', () => {
		it('meetsRequiredExternalTeams', () => {
			let _user = { bypassAccessCheck: true };
			let _team = {};

			let match = teamsService.meetsRequiredExternalTeams(_user, _team);

			match.should.equal(true);

			_user = { bypassAccessCheck: false };
			_team = {};

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			match.should.equal(false);

			_user = { bypassAccessCheck: false };
			_team = { requiresExternalTeams: ['one'] };

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			match.should.equal(false);

			_user = { bypassAccessCheck: false, externalGroups: ['two'] };
			_team = { requiresExternalTeams: ['one'] };

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			match.should.equal(false);

			_user = { bypassAccessCheck: false, externalGroups: ['one'] };
			_team = { requiresExternalTeams: ['one'] };

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			match.should.equal(true);

			_user = { bypassAccessCheck: false, externalGroups: ['two'] };
			_team = { requiresExternalTeams: ['one', 'two'] };

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			match.should.equal(true);

			_user = { bypassAccessCheck: false, externalGroups: ['two', 'four'] };
			_team = { requiresExternalTeams: ['one', 'two'] };

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			match.should.equal(true);

			_user = { bypassAccessCheck: false, externalGroups: ['two', 'four'] };
			_team = { requiresExternalTeams: ['four', 'one', 'two'] };

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			match.should.equal(true);

			_user = { bypassAccessCheck: false, externalGroups: ['two'] };
			_team = { requiresExternalTeams: [] };

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			match.should.equal(false);
		});
	});

	describe('meetsRequiredExternalRoles', () => {
		it('meetsRequiredExternalRoles', () => {
			let _user = {};
			let _team = {};

			let match = teamsService.meetsRequiredExternalRoles(_user, _team);

			match.should.equal(false);

			_user = {};
			_team = { requiresExternalRoles: ['one'] };

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			match.should.equal(false);

			_user = { externalRoles: ['two'] };
			_team = { requiresExternalRoles: ['one'] };

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			match.should.equal(false);

			_user = { externalRoles: ['one'] };
			_team = { requiresExternalRoles: ['one'] };

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			match.should.equal(true);

			_user = { externalRoles: ['two'] };
			_team = { requiresExternalRoles: ['one', 'two'] };

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			match.should.equal(false);

			_user = { externalRoles: ['one', 'two', 'three'] };
			_team = { requiresExternalRoles: ['one', 'two'] };

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			match.should.equal(true);

			_user = { externalRoles: ['two', 'four'] };
			_team = { requiresExternalRoles: ['four', 'one', 'two'] };

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			match.should.equal(false);

			_user = { externalRoles: ['two'] };
			_team = { requiresExternalRoles: [] };

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			match.should.equal(false);
		});
	});

	describe('isImplicitMember', () => {
		it('strategy = roles', () => {
			sandbox
				.stub(deps.config.teams, 'implicitMembers')
				.value({ strategy: 'roles' });

			it('should not match when user.externalRoles and team.requiresExternalRoles are undefined', () => {
				const _user = {};
				const _team = {};
				const match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);
			});

			it('should not match when team does not have requiresExternalRoles', () => {
				const _user = { externalRoles: ['one', 'two', 'three'] };
				let _team = {};
				let match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);

				_team = { requiresExternalRoles: [] };
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);
			});

			it('should match when user has required external roles', () => {
				const _user = { externalRoles: ['one', 'two', 'three'] };
				let _team = { requiresExternalRoles: ['one'] };
				let match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(true);

				_team = { requiresExternalRoles: ['one', 'two'] };
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(true);

				_team = { requiresExternalRoles: ['one', 'three'] };
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(true);
			});
		});

		describe('strategy = teams', () => {
			before(() => {
				sandbox
					.stub(deps.config.teams, 'implicitMembers')
					.value({ strategy: 'teams' });
			});

			it('should not match when user.externalRoles and team.requiresExternalTeams are undefined', () => {
				const _user = {};
				const _team = {};
				const match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);
			});

			it('should not match when team does not have requiresExternalTeams', () => {
				const _user = { externalGroups: ['one', 'two', 'three'] };
				let _team = {};
				let match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);

				_team = { requiresExternalTeams: [] };
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);
			});

			it('should match when user has required external teams', () => {
				let _user = { externalGroups: ['one'] };
				const _team = { requiresExternalTeams: ['one', 'two', 'three'] };
				let match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(true);

				_user = { externalGroups: ['two'] };
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(true);

				_user = { externalGroups: ['three'] };
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(true);
			});
		});

		describe('strategy = undefined', () => {
			before(() => {
				sandbox
					.stub(deps.config.teams, 'implicitMembers')
					.value({ strategy: null });
			});

			it('should not match any since disabled', () => {
				let _user = {};
				let _team = {};
				let match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);

				_user = {
					externalRoles: ['one', 'two', 'three'],
					externalGroups: ['one', 'two', 'three']
				};
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);

				_team = { requiresExternalRoles: [], requiresExternalGroups: [] };
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);

				_team = { requiresExternalRoles: ['one'] };
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);

				_team = { requiresExternalRoles: ['one', 'two'] };
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);

				_team = { requiresExternalRoles: ['one', 'three'] };
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);
			});
		});
	});

	describe('sendRequestEmail', () => {
		const toEmails = ['email1@server.com', 'email2@server.com'];

		it('should create mailOptions properly', async () => {
			const sendMailStub = sandbox.stub(deps.emailService, 'sendMail');

			const _user = {
				name: 'test',
				username: 'test',
				email: 'test@test.test'
			};

			const _team = {
				_id: '12345',
				name: 'test team'
			};

			const expectedEmailContent = `HEADER
<p>Hey there <strong>${_team.name}</strong> Admin,</p>
<p>A user named <strong>${_user.name}</strong> with username <strong>${_user.username}</strong> has requested access to the team.</p>
<p>Click <a href="${config.app.clientUrl}/team/${_team._id}">here</a> to give them access!</p>
FOOTER
`;

			await teamsService.sendRequestEmail(toEmails, _user, _team, {});

			sinon.assert.called(sendMailStub);
			const [mailOptions] = sendMailStub.getCall(0).args;

			should.exist(mailOptions, 'expected mailOptions to exist');

			for (const key of ['bcc', 'from', 'replyTo', 'subject', 'html']) {
				should.exist(mailOptions[key], `expected mailOptions.${key} to exist`);
			}

			mailOptions.bcc.should.be.Array();
			mailOptions.bcc.length.should.equal(2);
			mailOptions.bcc[0].should.equal(toEmails[0]);
			mailOptions.bcc[1].should.equal(toEmails[1]);
			mailOptions.from.should.equal(config.coreEmails.default.from);
			mailOptions.replyTo.should.equal(config.coreEmails.default.replyTo);
			mailOptions.subject.should.equal(
				`${config.app.title}: A user has requested access to Team ${_team.name}`
			);
			mailOptions.html.should.equal(expectedEmailContent);
		});

		it('should fail silently and log error', async () => {
			sandbox.stub(deps.emailService, 'sendMail').throws('error');
			const logStub = sandbox.stub(deps.logger, 'error');

			await teamsService.sendRequestEmail(
				toEmails,
				user.user1,
				team.teamWithNoExternalTeam,
				{}
			);

			sinon.assert.calledOnce(logStub);
			const [logOptions] = logStub.getCall(0).args;

			should.exist(logOptions.err);
			logOptions.err.name.should.equal('error');
		});
	});

	describe('requestAccessToTeam', () => {
		it('should reject if no team admins are found', async () => {
			await teamsService
				.requestAccessToTeam(user.admin, team.teamWithNoExternalTeam2, {})
				.should.be.rejectedWith({
					status: 404,
					message: 'Error retrieving team admins'
				});

			const requesterCount = await TeamMember.count({
				teams: {
					$elemMatch: {
						_id: new mongoose.Types.ObjectId(team.teamWithNoExternalTeam2._id),
						role: 'requester'
					}
				}
			}).exec();
			requesterCount.should.equal(0);
		});

		it('should work', async () => {
			await teamsService
				.requestAccessToTeam(user.admin, team.teamWithNoExternalTeam, {})
				.should.be.fulfilled();

			const requesterCount = await TeamMember.count({
				teams: {
					$elemMatch: {
						_id: new mongoose.Types.ObjectId(team.teamWithNoExternalTeam._id),
						role: 'requester'
					}
				}
			}).exec();
			requesterCount.should.equal(1);
		});
	});

	describe('requestNewTeam', () => {
		const _user = new User({
			name: 'test',
			username: 'test',
			email: 'test@test.test'
		});

		it('should properly reject invalid parameters', async () => {
			let error = null;
			try {
				await teamsService.requestNewTeam();
			} catch (e) {
				error = e;
			}

			should.exist(error);
			error.status.should.equal(400);
			error.message.should.equal('Organization cannot be empty');

			error = null;
			try {
				await teamsService.requestNewTeam('org');
			} catch (e) {
				error = e;
			}

			should.exist(error);
			error.status.should.equal(400);
			error.message.should.equal('AOI cannot be empty');

			error = null;
			try {
				await teamsService.requestNewTeam('org', 'aoi');
			} catch (e) {
				error = e;
			}

			should.exist(error);
			error.status.should.equal(400);
			error.message.should.equal('Description cannot be empty');

			error = null;
			try {
				await teamsService.requestNewTeam('org', 'aoi', 'description');
			} catch (e) {
				error = e;
			}

			should.exist(error);
			error.status.should.equal(400);
			error.message.should.equal('Invalid requester');
		});

		it('should create mailOptions properly', async () => {
			const sendMailStub = sandbox.stub(deps.emailService, 'sendMail');

			const expectedEmailContent = `HEADER
<p>Hey there ${config.app.title} Admins,</p>
<p>A user named <strong>${_user.name}</strong> with username <strong>${_user.username}</strong> has requested a new team:</p>
<p>
\t<strong>Organization:</strong> org<br/>
\t<strong>AOI:</strong> aoi<br/>
\t<strong>Description:</strong> description<br/>
</p>
<p>Click <a href="${config.app.clientUrl}/team/create">here</a> to create this team!</p>
FOOTER
`;

			await teamsService.requestNewTeam('org', 'aoi', 'description', _user, {
				headers: {}
			});

			sinon.assert.called(sendMailStub);
			const [mailOptions] = sendMailStub.getCall(0).args;

			should.exist(mailOptions, 'expected mailOptions to exist');

			for (const key of ['bcc', 'from', 'replyTo', 'subject', 'html']) {
				should.exist(mailOptions[key], `expected mailOptions.${key} to exist`);
			}

			mailOptions.bcc.should.equal(config.coreEmails.newTeamRequest.bcc);
			mailOptions.from.should.equal(config.coreEmails.default.from);
			mailOptions.replyTo.should.equal(config.coreEmails.default.replyTo);
			mailOptions.subject.should.equal('New Team Requested');
			mailOptions.html.should.equal(expectedEmailContent);
		});

		it('should fail silently and log error', async () => {
			sandbox.stub(deps.emailService, 'sendMail').throws('error');
			const logStub = sandbox.stub(deps.logger, 'error');

			await teamsService.requestNewTeam(
				'org',
				'aoi',
				'description',
				user.user1,
				{ headers: {} }
			);

			sinon.assert.calledOnce(logStub);
			const [logOptions] = logStub.getCall(0).args;

			should.exist(logOptions.err);
			logOptions.err.name.should.equal('error');
		});
	});

	describe('getImplicitTeamIds', () => {
		describe('strategy = roles', () => {
			before(() => {
				sandbox
					.stub(deps.config.teams, 'implicitMembers')
					.value({ strategy: 'roles' });
			});

			it('reject for non-existent user', async () => {
				await teamsService.getImplicitTeamIds(null).should.be.rejectedWith({
					status: 401,
					type: 'bad-request',
					message: 'User does not exist'
				});
			});

			it('should find implicit teams for user with matching external roles (model object)', async () => {
				const teamIds = await teamsService.getImplicitTeamIds(user.implicit2);
				should.exist(teamIds);
				teamIds.should.be.Array();
				teamIds.length.should.equal(2);
			});

			it('should find implicit teams for user with matching external roles (plain object)', async () => {
				const teamIds = await teamsService.getImplicitTeamIds(
					user.implicit2.toObject()
				);
				should.exist(teamIds);
				teamIds.should.be.Array();
				teamIds.length.should.equal(2);
			});

			it('should not find implicit teams for user without matching external roles', async () => {
				const _user = await User.findOne({
					username: 'implicit1_username'
				}).exec();
				should.exist(_user, 'expected implicit1 to exist');
				_user.username.should.equal('implicit1_username');

				const teamIds = await teamsService.getImplicitTeamIds(_user);
				should.exist(teamIds);
				teamIds.should.be.Array();
				teamIds.should.be.empty();
			});

			it('should not find implicit teams for user with matching external roles, but is explicitly blocked', async () => {
				const _user = await User.findOne({
					username: 'blocked_username'
				}).exec();
				should.exist(_user, 'expected blocked to exist');
				_user.username.should.equal('blocked_username');

				const teamIds = await teamsService.getImplicitTeamIds(_user);
				should.exist(teamIds);
				teamIds.should.be.Array();
				teamIds.should.be.empty();
			});
		});

		describe('strategy = teams;', () => {
			before(() => {
				sandbox
					.stub(deps.config.teams, 'implicitMembers')
					.value({ strategy: 'teams' });
			});

			it('should find implicit teams for user with matching external teams', async () => {
				const _user = await User.findOne({
					username: 'implicit1_username'
				}).exec();
				should.exist(_user, 'expected implicit1 to exist');
				_user.username.should.equal('implicit1_username');

				const teamIds = await teamsService.getImplicitTeamIds(_user);
				should.exist(teamIds);
				teamIds.should.be.Array();
				teamIds.length.should.equal(1);
			});

			it('should not find implicit teams for user without matching external teams', async () => {
				const _user = await User.findOne({
					username: 'implicit2_username'
				}).exec();
				should.exist(_user, 'expected user2 to exist');
				_user.username.should.equal('implicit2_username');

				const teamIds = await teamsService.getImplicitTeamIds(_user);
				should.exist(teamIds);
				teamIds.should.be.Array();
				teamIds.should.be.empty();
			});
		});

		describe('strategy = null;', () => {
			before(() => {
				sandbox
					.stub(deps.config.teams, 'implicitMembers')
					.value({ strategy: null });
			});

			it('should not find implicit teams for users with matching external roles/teams if disabled', async () => {
				const user1 = await User.findOne({ username: 'user1_username' }).exec();
				should.exist(user1, 'expected user1 to exist');
				user1.username.should.equal('user1_username');

				const user2 = await User.findOne({ username: 'user2_username' }).exec();
				should.exist(user2, 'expected user2 to exist');
				user2.username.should.equal('user2_username');

				let teamIds = await teamsService.getImplicitTeamIds(user1);
				should.exist(teamIds);
				teamIds.should.be.Array();
				teamIds.should.be.empty();

				teamIds = await teamsService.getImplicitTeamIds(user2);
				should.exist(teamIds);
				teamIds.should.be.Array();
				teamIds.should.be.empty();
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
				should.exist(role);
				role.should.equal('member');
			});

			it('Should get team role for nested team when nested teams are enabled', () => {
				sandbox.stub(deps.config.teams, 'nestedTeams').value(true);
				const role = teamsService.getActiveTeamRole(
					user.user1,
					team.nestedTeam2_1
				);
				should.exist(role);
				role.should.equal('member');
			});

			it('Should not get team role for nested team when nested teams are disabled', () => {
				sandbox.stub(deps.config.teams, 'nestedTeams').value(false);
				const role = teamsService.getActiveTeamRole(
					user.user1,
					team.nestedTeam2_1
				);
				should.not.exist(role);
			});

			it('Should not get team role for nested team', () => {
				const role = teamsService.getActiveTeamRole(
					user.user2,
					team.nestedTeam1
				);
				should.not.exist(role);
			});
		});

		describe('getNestedTeamIds', () => {
			it('return empty array if nestedTeams is disabled in config', async () => {
				sandbox.stub(deps.config.teams, 'nestedTeams').value(false);

				const nestedTeamIds = await teamsService.getNestedTeamIds([
					team.teamWithNoExternalTeam._id
				]);

				should.exist(nestedTeamIds);
				nestedTeamIds.should.be.Array();
				nestedTeamIds.length.should.equal(0);
			});

			it('undefined parent teams', async () => {
				sandbox.stub(deps.config.teams, 'nestedTeams').value(true);

				const nestedTeamIds = await teamsService.getNestedTeamIds();

				should.exist(nestedTeamIds);
				nestedTeamIds.should.be.Array();
				nestedTeamIds.length.should.equal(0);
			});

			it('empty parent teams array', async () => {
				sandbox.stub(deps.config.teams, 'nestedTeams').value(true);

				const nestedTeamIds = await teamsService.getNestedTeamIds([]);

				should.exist(nestedTeamIds);
				nestedTeamIds.should.be.Array();
				nestedTeamIds.length.should.equal(0);
			});

			it('default/all roles', async () => {
				sandbox.stub(deps.config.teams, 'nestedTeams').value(true);

				const nestedTeamIds = await teamsService.getNestedTeamIds([
					team.teamWithNoExternalTeam._id
				]);

				should.exist(nestedTeamIds);
				nestedTeamIds.should.be.Array();
				nestedTeamIds.length.should.equal(6);
			});

			it('explicitly pass "member" role', async () => {
				sandbox.stub(deps.config.teams, 'nestedTeams').value(true);

				const nestedTeamIds = await teamsService.getNestedTeamIds([
					team.nestedTeam1._id
				]);

				should.exist(nestedTeamIds);
				nestedTeamIds.should.be.Array();
				nestedTeamIds.length.should.equal(2);
			});
		});

		describe('getAncestorTeamIds', () => {
			it('should return team ancestors', async () => {
				const ancestors = await teamsService.getAncestorTeamIds([
					team.nestedTeam2_1._id
				]);
				ancestors.should.deepEqual([
					team.teamWithNoExternalTeam._id,
					team.nestedTeam2._id
				]);
			});

			it('should return empty array for team without ancestors', async () => {
				const ancestors = await teamsService.getAncestorTeamIds([
					team.teamWithNoExternalTeam._id
				]);
				ancestors.should.deepEqual([]);
			});

			it('should return empty array when no teams are passed in', async () => {
				const ancestors = await teamsService.getAncestorTeamIds();
				ancestors.should.deepEqual([]);
			});
		});

		describe('updateTeams', () => {
			it('implicit members disabled; nested teams disabled', async () => {
				sandbox.stub(deps.config.teams, 'implicitMembers').value({});
				sandbox.stub(deps.config.teams, 'nestedTeams').value(false);

				const user = {
					teams: [
						{ role: 'member', _id: team.teamWithNoExternalTeam._id },
						{ role: 'editor', _id: team.nestedTeam1._id },
						{ role: 'admin', _id: team.nestedTeam2._id }
					],
					externalRoles: ['external-role']
				};
				await teamsService.updateTeams(user);

				user.teams.length.should.equal(3);
			});

			it('implicit members enabled; nested teams disabled', async () => {
				sandbox
					.stub(deps.config.teams, 'implicitMembers')
					.value({ strategy: 'roles' });
				sandbox.stub(deps.config.teams, 'nestedTeams').value(false);

				const user = {
					teams: [
						{ role: 'member', _id: team.teamWithNoExternalTeam._id },
						{ role: 'editor', _id: team.nestedTeam1._id },
						{ role: 'admin', _id: team.nestedTeam2._id }
					],
					externalRoles: ['external-role']
				};
				await teamsService.updateTeams(user);

				user.teams.length.should.equal(4);
			});

			it('implicit members disabled; nested teams enabled', async () => {
				sandbox.stub(deps.config.teams, 'implicitMembers').value({});
				sandbox.stub(deps.config.teams, 'nestedTeams').value(true);

				const user = {
					teams: [
						{ role: 'member', _id: team.teamWithNoExternalTeam._id },
						{ role: 'editor', _id: team.nestedTeam1._id },
						{ role: 'admin', _id: team.nestedTeam2._id }
					],
					externalRoles: ['external-role']
				};
				await teamsService.updateTeams(user);

				user.teams.length.should.equal(7);
			});

			it('implicit members enabled; nested teams enabled', async () => {
				sandbox
					.stub(deps.config.teams, 'implicitMembers')
					.value({ strategy: 'roles' });
				sandbox.stub(deps.config.teams, 'nestedTeams').value(true);

				const user = {
					teams: [
						{ role: 'member', _id: team.teamWithNoExternalTeam._id },
						{ role: 'editor', _id: team.nestedTeam1._id },
						{ role: 'admin', _id: team.nestedTeam2._id }
					],
					externalRoles: ['external-role']
				};
				await teamsService.updateTeams(user);

				user.teams.length.should.equal(8);
			});
		});
	});

	describe('getExplicitTeamIds', () => {
		const _user = {
			teams: [
				{
					_id: '000000000000000000000001',
					role: 'member'
				},
				{
					_id: '000000000000000000000002',
					role: 'member'
				},
				{
					_id: '000000000000000000000003',
					role: 'editor'
				},
				{
					_id: '000000000000000000000004',
					role: 'admin'
				},
				{
					_id: '000000000000000000000005',
					role: 'editor'
				}
			]
		};

		it('should reject for non-existent user', async () => {
			await teamsService.getExplicitTeamIds(null).should.be.rejectedWith({
				status: 401,
				type: 'bad-request',
				message: 'User does not exist'
			});
		});

		it('should return no teams for user with empty teams array', async () => {
			const teamIds = await teamsService.getExplicitTeamIds({ teams: [] });

			should.exist(teamIds, 'expected teamIds to exist');
			teamIds.length.should.equal(0);
		});

		it('should return no teams for user with no teams array', async () => {
			const teamIds = await teamsService.getExplicitTeamIds({});

			should.exist(teamIds, 'expected teamIds to exist');
			teamIds.length.should.equal(0);
		});

		it('should return all team ids when roles is not specified', async () => {
			const teamIds = await teamsService.getExplicitTeamIds(_user);

			should.exist(teamIds, 'expected teamIds to exist');
			teamIds.length.should.equal(5);

			for (let i = 0; i < teamIds.length; i++) {
				teamIds[i].should.equal(_user.teams[i]._id.toString());
			}
		});

		it('should return only team ids where user is a member', async () => {
			const teamIds = await teamsService.getExplicitTeamIds(_user, 'member');

			should.exist(teamIds, 'expected teamIds to exist');
			teamIds.length.should.equal(2);

			teamIds[0].should.equal('000000000000000000000001');
			teamIds[1].should.equal('000000000000000000000002');
		});

		it('should return only team ids where user is an editor', async () => {
			const teamIds = await teamsService.getExplicitTeamIds(_user, 'editor');

			should.exist(teamIds, 'expected teamIds to exist');
			teamIds.length.should.equal(2);

			teamIds[0].should.equal('000000000000000000000003');
			teamIds[1].should.equal('000000000000000000000005');
		});

		it('should return only team ids where user is an admin', async () => {
			const teamIds = await teamsService.getExplicitTeamIds(_user, 'admin');

			should.exist(teamIds, 'expected teamIds to exist');
			teamIds.length.should.equal(1);

			teamIds[0].should.equal('000000000000000000000004');
		});
	});

	describe('getTeamIds', () => {
		const _user = {
			teams: [
				{
					_id: '000000000000000000000001',
					role: 'member'
				},
				{
					_id: '000000000000000000000002',
					role: 'member'
				},
				{
					_id: '000000000000000000000003',
					role: 'editor'
				},
				{
					_id: '000000000000000000000004',
					role: 'admin'
				},
				{
					_id: '000000000000000000000005',
					role: 'editor'
				}
			]
		};

		it('should find all team members', async () => {
			const teamIds = await teamsService.getMemberTeamIds(_user);
			should.exist(teamIds);
			teamIds.should.have.length(5);
		});

		it('should find all team editors', async () => {
			const teamIds = await teamsService.getEditorTeamIds(_user);
			should.exist(teamIds);
			teamIds.should.have.length(3);
		});

		it('should find all team admins', async () => {
			const teamIds = await teamsService.getAdminTeamIds(_user);
			should.exist(teamIds);
			teamIds.should.have.length(1);
		});

		it('should not', async () => {
			const teamIds = await teamsService.getMemberTeamIds(user.blocked);
			should.exist(teamIds);
			teamIds.should.have.length(0);
		});
	});

	describe('filterTeamIds', () => {
		const _user = {
			teams: [
				{
					_id: new mongoose.Types.ObjectId('000000000000000000000001'),
					role: 'member'
				},
				{
					_id: new mongoose.Types.ObjectId('000000000000000000000002'),
					role: 'member'
				},
				{
					_id: new mongoose.Types.ObjectId('000000000000000000000003'),
					role: 'editor'
				},
				{
					_id: new mongoose.Types.ObjectId('000000000000000000000004'),
					role: 'admin'
				},
				{
					_id: new mongoose.Types.ObjectId('000000000000000000000005'),
					role: 'editor'
				}
			]
		};

		it('should filter teamIds for membership (basic)', async () => {
			const teamIds = await teamsService.filterTeamIds(_user, [
				new mongoose.Types.ObjectId('000000000000000000000001')
			]);
			should.exist(teamIds);
			teamIds.should.have.length(1);
			should(teamIds[0].toString()).equal('000000000000000000000001');
		});

		it('should filter teamIds for membership (advanced)', async () => {
			const teamIds = await teamsService.filterTeamIds(_user, [
				new mongoose.Types.ObjectId('000000000000000000000001'),
				new mongoose.Types.ObjectId('000000000000000000000002')
			]);
			should.exist(teamIds);
			teamIds.should.have.length(2);
			should(teamIds[0].toString()).equal('000000000000000000000001');
			should(teamIds[1].toString()).equal('000000000000000000000002');
		});

		it('should filter teamIds for membership when no access', async () => {
			const teamIds = await teamsService.filterTeamIds(_user, [
				new mongoose.Types.ObjectId('000000000000000000000006')
			]);
			should.exist(teamIds);
			teamIds.should.have.length(0);
		});

		it('should filter teamIds for membership when no filter', async () => {
			const teamIds = await teamsService.filterTeamIds(_user);
			should.exist(teamIds);
			teamIds.should.have.length(5);
			should(teamIds[0].toString()).equal('000000000000000000000001');
			should(teamIds[1].toString()).equal('000000000000000000000002');
			should(teamIds[2].toString()).equal('000000000000000000000003');
			should(teamIds[3].toString()).equal('000000000000000000000004');
			should(teamIds[4].toString()).equal('000000000000000000000005');
		});
	});
});
