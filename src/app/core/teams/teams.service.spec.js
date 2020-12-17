'use strict';

const
	_ = require('lodash'),
	should = require('should'),
	sinon = require('sinon'),

	deps = require('../../../dependencies'),
	config = deps.config,
	dbs = deps.dbs,

	teamsService = require('./teams.service'),

	User = dbs.admin.model('User'),
	Team = dbs.admin.model('Team'),
	TeamMember = dbs.admin.model('TeamUser'),
	TeamRole = dbs.admin.model('TeamRole');

/**
 * Helpers
 */
function clearDatabase() {
	return Promise.all([
		Team.deleteMany({}).exec(),
		User.deleteMany({}).exec()
	]);
}

function userSpec(key) {
	return {
		name: `${key} Name`,
		email: `${key}@mail.com`,
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

function localUserSpec(key){
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
	const spec = { team: {}, user: {} };

	// Teams for tests
	spec.team.teamWithExternalTeam = teamSpec('external-team');
	spec.team.teamWithExternalTeam.implicitMembers = true;
	spec.team.teamWithExternalTeam.requiresExternalTeams = ['external-group'];

	spec.team.teamWithExternalRoles = teamSpec('external-roles');
	spec.team.teamWithExternalRoles.implicitMembers = true;
	spec.team.teamWithExternalRoles.requiresExternalRoles = ['external-role'];

	spec.team.teamWithNoExternalTeam = teamSpec('no-external');
	spec.team.teamWithNoExternalTeam.requiresExternalTeams = [];

	spec.team.teamWithNullRequiredExternalRoles = teamSpec('req-roles-null');
	spec.team.teamWithNullRequiredExternalRoles.requiresExternalRoles = null;

	// User implicit added to team by having an external group
	spec.user.implicit1 = proxyPkiUserSpec('implicit1');
	spec.user.implicit1.externalGroups = ['external-group'];

	// User implicit added to team by having an external role
	spec.user.implicit2 = proxyPkiUserSpec('implicit2');
	spec.user.implicit2.externalRoles = ['external-role'];

	// User explicitly added to a group.  Group is added in before() block below
	spec.user.explicit = proxyPkiUserSpec('explicit');

	// Generic test users
	spec.user.user1 = localUserSpec('user1');

	spec.user.user2 = localUserSpec('user2');

	spec.user.user3 = localUserSpec('user3');

	const user = {};
	let team = {};

	let sandbox;

	beforeEach(async () => {
		sandbox = sinon.createSandbox();

		await clearDatabase();

		const teamDefers = [];

		// Create the teams
		_.keys(spec.team).forEach((k) => {
			teamDefers.push((new Team(spec.team[k])).save().then((e) => {
				team[k] = e;
			}));
		});

		await Promise.all(teamDefers);

		const userDefers = [];
		_.keys(spec.user).forEach((k) => {
			userDefers.push((new User(spec.user[k])).save().then((e) => {
				user[k] = e;

				// Do this here because of issues using extended mongo schema in tests
				if (k === 'explicit') {
					return TeamMember.updateOne(
						{ _id: e._id },
						{ $addToSet: { teams: new TeamRole({ _id: team.teamWithNoExternalTeam._id, role: 'member' }) } }
					).exec();
				}
			}));
		});

		return Promise.all(userDefers);
	});

	afterEach(() => {
		sandbox.restore();
		return clearDatabase();
	});

	// Test implicit team membership
	describe('searchTeamMembers', () => {
		beforeEach(() => {
			sandbox.stub(deps.config.teams, 'implicitMembers').value({ strategy: 'teams' });
		});

		it('user implicitly added to a team via externalGroups', async () => {
			const queryParams = { dir: 'ASC', page: '0', size: '5', sort: 'name' };

			const _team = await Team.findOne({ name: 'external-team' }).exec();

			const searchResults = await teamsService.searchTeamMembers(null, {}, queryParams, _team);
			searchResults.elements.should.have.length(1);
			searchResults.elements[0].name.should.equal('implicit1 Name');
		});

		// Test explicit team membership
		it('user explicitly added to a team through the user.teams property', async () => {
			const queryParams = { dir: 'ASC', page: '0', size: '5', sort: 'name' };

			const _team = await Team.findOne({ name: 'no-external' }).exec();

			const searchResults = await teamsService.searchTeamMembers(null, {}, queryParams, _team);
			searchResults.elements.should.be.an.Array();
			searchResults.elements.should.have.length(1);
			searchResults.elements[0].name.should.equal('explicit Name');
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
			_team = { requiresExternalTeams: ['one']};

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			match.should.equal(false);

			_user = { bypassAccessCheck: false, externalGroups: ['two'] };
			_team = { requiresExternalTeams: ['one']};

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			match.should.equal(false);

			_user = { bypassAccessCheck: false, externalGroups: ['one'] };
			_team = { requiresExternalTeams: ['one']};

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			match.should.equal(true);

			_user = { bypassAccessCheck: false, externalGroups: ['two'] };
			_team = { requiresExternalTeams: ['one', 'two']};

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			match.should.equal(true);

			_user = { bypassAccessCheck: false, externalGroups: ['two', 'four'] };
			_team = { requiresExternalTeams: ['one', 'two']};

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			match.should.equal(true);

			_user = { bypassAccessCheck: false, externalGroups: ['two', 'four'] };
			_team = { requiresExternalTeams: ['four', 'one', 'two']};

			match = teamsService.meetsRequiredExternalTeams(_user, _team);

			match.should.equal(true);

			_user = { bypassAccessCheck: false, externalGroups: ['two'] };
			_team = { requiresExternalTeams: []};

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
			_team = { requiresExternalRoles: ['one']};

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			match.should.equal(false);

			_user = { externalRoles: ['two'] };
			_team = { requiresExternalRoles: ['one']};

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			match.should.equal(false);

			_user = { externalRoles: ['one'] };
			_team = { requiresExternalRoles: ['one']};

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			match.should.equal(true);

			_user = { externalRoles: ['two'] };
			_team = { requiresExternalRoles: ['one', 'two']};

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			match.should.equal(false);

			_user = { externalRoles: ['one', 'two', 'three'] };
			_team = { requiresExternalRoles: ['one', 'two']};

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			match.should.equal(true);

			_user = { externalRoles: ['two', 'four'] };
			_team = { requiresExternalRoles: ['four', 'one', 'two']};

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			match.should.equal(false);

			_user = { externalRoles: ['two'] };
			_team = { requiresExternalRoles: []};

			match = teamsService.meetsRequiredExternalRoles(_user, _team);

			match.should.equal(false);
		});
	});

	describe('isImplicitMember',  () => {
		it('strategy = roles', () => {
			sandbox.stub(deps.config.teams, 'implicitMembers').value({ strategy: 'roles' });

			it('should not match when user.externalRoles and team.requiresExternalRoles are undefined', () => {
				const _user = {};
				const _team = {};
				const match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);
			});

			it('should not match when team does not have requiresExternalRoles', () => {
				const _user = { externalRoles: ['one', 'two', 'three'] };
				let _team = { };
				let match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);

				_team = { requiresExternalRoles: [] };
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);
			});

			it('should match when user has required external roles', () => {
				const _user = { externalRoles: ['one', 'two', 'three'] };
				let _team = { requiresExternalRoles: ['one']};
				let match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(true);

				_team = { requiresExternalRoles: ['one', 'two']};
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(true);

				_team = { requiresExternalRoles: ['one', 'three']};
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(true);
			});
		});

		describe('strategy = teams', () => {
			before(() => {
				sandbox.stub(deps.config.teams, 'implicitMembers').value({ strategy: 'teams' });
			});

			it('should not match when user.externalRoles and team.requiresExternalTeams are undefined', () => {
				const _user = {};
				const _team = {};
				const match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);
			});

			it('should not match when team does not have requiresExternalTeams', () => {
				const _user = { externalGroups: ['one', 'two', 'three'] };
				let _team = { };
				let match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);

				_team = { requiresExternalTeams: [] };
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);
			});

			it('should match when user has required external teams', () => {
				let _user = { externalGroups: ['one'] };
				const _team = { requiresExternalTeams: ['one', 'two', 'three']};
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
				sandbox.stub(deps.config.teams, 'implicitMembers').value({ strategy: null });
			});

			it('should not match any since disabled', () => {
				let _user = {};
				let _team = {};
				let match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);

				_user = { externalRoles: ['one', 'two', 'three'], externalGroups: ['one', 'two', 'three'] };
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);

				_team = { requiresExternalRoles: [], requiresExternalGroups: [] };
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);

				_team = { requiresExternalRoles: ['one']};
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);

				_team = { requiresExternalRoles: ['one', 'two']};
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);

				_team = { requiresExternalRoles: ['one', 'three']};
				match = teamsService.isImplicitMember(_user, _team);
				match.should.equal(false);
			});
		});

	});

	// Test team creation
	describe('createTeam', () => {
		it('explicit admin should be used', async () => {
			const queryParams = { dir: 'ASC', page: '0', size: '5', sort: 'name' };
			const creator = await User.findOne({ name: 'user1 Name' }).exec();
			const admin = await User.findOne({ name: 'user2 Name' }).exec();

			await teamsService.createTeam(teamSpec('test-create-2'), creator, admin, {});
			team = await Team.findOne({ name: 'test-create-2' }).exec();
			const members = await teamsService.searchTeamMembers(null, {}, queryParams, team);
			(members.elements).should.have.length(1);
			(members.elements[0]).name.should.equal(admin.name);
		});

		it('null admin should default admin to creator', async () => {
			const queryParams = {dir: 'ASC', page: '0', size: '5', sort: 'name'};
			const creator = await User.findOne({name: 'user1 Name'}).exec();

			// null admin should default to creator
			await teamsService.createTeam(teamSpec('test-create'), creator, null, {});
			const _team = await Team.findOne({name: 'test-create'}).exec();
			const members = await teamsService.searchTeamMembers(null, {}, queryParams, _team);
			(members.elements).should.have.length(1);
			(members.elements[0]).name.should.equal(creator.name);
		});
	});

	describe('getImplicitTeamIds',  () => {

		describe('strategy = roles', () => {
			before(() => {
				sandbox.stub(deps.config.teams, 'implicitMembers').value({ strategy: 'roles' });
			});

			it('should find implicit teams for user with matching external roles', async () => {
				const _user = await User.findOne({username: 'implicit2_username'}).exec();
				should.exist(_user, 'expected implicit2 to exist');
				_user.username.should.equal('implicit2_username');

				const teamIds = await teamsService.getImplicitTeamIds(_user);
				should.exist(teamIds);
				teamIds.should.be.Array();
				teamIds.length.should.equal(1);
			});

			it('should not find implicit teams for user without matching external roles', async () => {
				const _user = await User.findOne({username: 'implicit1_username'}).exec();
				should.exist(_user, 'expected implicit1 to exist');
				_user.username.should.equal('implicit1_username');

				const teamIds = await teamsService.getImplicitTeamIds(_user);
				should.exist(teamIds);
				teamIds.should.be.Array();
				teamIds.should.be.empty();
			});

		});

		describe('strategy = teams;', () => {
			before(() => {
				sandbox.stub(deps.config.teams, 'implicitMembers').value({ strategy: 'teams' });
			});

			it('should find implicit teams for user with matching external teams', async () => {
				const _user = await User.findOne({username: 'implicit1_username'}).exec();
				should.exist(_user, 'expected implicit1 to exist');
				_user.username.should.equal('implicit1_username');

				const teamIds = await teamsService.getImplicitTeamIds(_user);
				should.exist(teamIds);
				teamIds.should.be.Array();
				teamIds.length.should.equal(1);
			});

			it('should not find implicit teams for user without matching external teams', async () => {
				const _user = await User.findOne({username: 'implicit2_username'}).exec();
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
				sandbox.stub(deps.config.teams, 'implicitMembers').value({ strategy: null });
			});

			it('should not find implicit teams for users with matching external roles/teams if disabled', async () => {
				const user1 = await User.findOne({username: 'user1_username'}).exec();
				should.exist(user1, 'expected user1 to exist');
				user1.username.should.equal('user1_username');

				const user2 = await User.findOne({username: 'user2_username'}).exec();
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

	describe('sendRequestEmail', () => {
		it('should create mailOptions properly', async() => {
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

			const toEmails = ['email1@server.com', 'email2@server.com'];

			const expectedEmailContent = `<p>Hey there <strong>${_team.name}</strong> Admin,</p>
<p>A user named <strong>${_user.name}</strong> with username <strong>${_user.username}</strong> has requested access to the team.</p>
<p>Click <a href="${config.app.clientUrl}/team/${_team._id}">here</a> to give them access!</p>
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
			mailOptions.subject.should.equal(`${config.app.title}: A user has requested access to Team ${_team.name}`);
			mailOptions.html.should.equal(expectedEmailContent);
		});
	});

	describe('requestNewTeam', () => {
		const _user = new User({
			name: 'test',
			username: 'test',
			email: 'test@test.test'
		});

		it ('should properly reject invalid parameters', async () => {
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

		it('should create mailOptions properly', async() => {
			const sendMailStub = sandbox.stub(deps.emailService, 'sendMail');

			const expectedEmailContent = `<p>Hey there ${config.app.title} Admins,</p>
<p>A user named <strong>${_user.name}</strong> with username <strong>${_user.username}</strong> has requested a new team:</p>
<p>
\t<strong>Organization:</strong> org<br/>
\t<strong>AOI:</strong> aoi<br/>
\t<strong>Description:</strong> description<br/>
</p>
<p>Click <a href="${config.app.clientUrl}/team/create">here</a> to create this team!</p>
`;

			await teamsService.requestNewTeam('org', 'aoi', 'description', _user, { headers: {} });

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
	});

	describe('getTeamIds', () => {
		const _user = {
			teams: [{
				_id: 1, role: 'member'
			}, {
				_id: 2, role: 'member'
			}, {
				_id: 3, role: 'editor'
			}, {
				_id: 4, role: 'admin'
			}, {
				_id: 5, role: 'editor'
			}]
		};

		it('should return all team ids when roles is not specified', async () => {
			const teamIds = await teamsService.getTeamIds(_user);

			should.exist(teamIds, 'expected teamIds to exist');
			teamIds.length.should.equal(5);

			for (let i = 0; i < teamIds.length; i++) {
				teamIds[i].should.equal(_user.teams[i]._id.toString());
			}
		});

		it('should return only team ids where user is a member', async () => {
			const teamIds = await teamsService.getTeamIds(_user, 'member');

			should.exist(teamIds, 'expected teamIds to exist');
			teamIds.length.should.equal(2);

			teamIds[0].should.equal('1');
			teamIds[1].should.equal('2');
		});

		it('should return only team ids where user is an editor', async () => {
			const teamIds = await teamsService.getTeamIds(_user, 'editor');

			should.exist(teamIds, 'expected teamIds to exist');
			teamIds.length.should.equal(2);

			teamIds[0].should.equal('3');
			teamIds[1].should.equal('5');
		});

		it('should return only team ids where user is an admin', async () => {
			const teamIds = await teamsService.getTeamIds(_user, 'admin');

			should.exist(teamIds, 'expected teamIds to exist');
			teamIds.length.should.equal(1);

			teamIds[0].should.equal('4');
		});

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
	});

	describe('filterTeamIds', () => {
		const _user = {
			teams: [{
				_id: 1, role: 'member'
			}, {
				_id: 2, role: 'member'
			}, {
				_id: 3, role: 'editor'
			}, {
				_id: 4, role: 'admin'
			}, {
				_id: 5, role: 'editor'
			}]
		};

		it ('should filter teamIds for membership (basic)', async () => {
			const teamIds = await teamsService.filterTeamIds(_user, ['1']);
			should.exist(teamIds);
			teamIds.should.have.length(1);
			should(teamIds[0]).equal('1');
		});

		it ('should filter teamIds for membership (advanced)', async () => {
			const teamIds = await teamsService.filterTeamIds(_user, [ '1', '2']);
			should.exist(teamIds);
			teamIds.should.have.length(2);
			should(teamIds[0]).equal('1');
			should(teamIds[1]).equal('2');
		});

		it ('should filter teamIds for membership when no access', async () => {
			const teamIds = await teamsService.filterTeamIds(_user, [ '6' ]);
			should.exist(teamIds);
			teamIds.should.have.length(0);
		});

		it ('should filter teamIds for membership when no filter', async () => {
			const teamIds = await teamsService.filterTeamIds(_user);
			should.exist(teamIds);
			teamIds.should.have.length(5);
			should(teamIds[0]).equal('1');
			should(teamIds[1]).equal('2');
			should(teamIds[2]).equal('3');
			should(teamIds[3]).equal('4');
			should(teamIds[4]).equal('5');
		});
	});
});
