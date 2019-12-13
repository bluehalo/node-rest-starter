'use strict';

const
	_ = require('lodash'),
	q = require('q'),
	should = require('should'),
	proxyquire = require('proxyquire'),

	deps = require('../../../dependencies'),
	config = deps.config,
	dbs = deps.dbs,

	User = dbs.admin.model('User'),
	Team = dbs.admin.model('Team'),
	TeamMember = dbs.admin.model('TeamUser'),
	TeamRole = dbs.admin.model('TeamRole');

/**
 * Helpers
 */
function createSubjectUnderTest(dependencies) {
	const stubs = {};
	stubs['../../../dependencies'] = dependencies || {};
	return proxyquire('./teams.service', stubs)();
}

function clearDatabase() {
	return q.all([
		Team.remove(),
		User.remove()
	]);
}

function userSpec(key) {
	return {
		name: key + ' Name',
		email: key + '@mail.com',
		username: key + '_username',
		organization: key + ' Organization'
	};
}

function proxyPkiUserSpec(key) {
	let spec = userSpec(key);
	spec.provider = 'proxy-pki';
	spec.providerData = {
		dn: key,
		dnLower: key.toLowerCase()
	};
	return spec;
}

function localUserSpec(key){
	let spec = userSpec(key);
	spec.provider = 'local';
	spec.password = 'password';
	return spec;
}

function teamSpec(key) {
	return {
		name: key,
		description: key + 'Team Description '
	};
}

/**
 * Unit tests
 */
describe('Team Service:', function() {
	// Specs for tests
	let spec = { team: {}, user: {} };

	// Teams for tests
	spec.team.teamWithExternalTeam = teamSpec('external');
	spec.team.teamWithExternalTeam.requiresExternalTeams = ['external-group'];

	spec.team.teamWithNoExternalTeam = teamSpec('no-external');
	spec.team.teamWithNoExternalTeam.requiresExternalTeams = [];

	// User implicit added to team by having an external group
	spec.user.implicit = proxyPkiUserSpec('implicit');
	spec.user.implicit.externalGroups = ['external-group'];

	// User explicitly added to a group.  Group is added in before() block below
	spec.user.explicit = proxyPkiUserSpec('explicit');

	// Generic test users
	spec.user.user1 = localUserSpec('user1');
	spec.user.user2 = localUserSpec('user2');

	let user = {};
	let team = {};

	before(function() {
		return clearDatabase().then(() => {
			let teamDefers = [];

			// Create the teams
			_.keys(spec.team).forEach((k) => {
				teamDefers.push((new Team(spec.team[k])).save().then((e) => {
					team[k] = e;
				}));
			});

			return q.all(teamDefers).then((result) => {

				let userDefers = [];
				_.keys(spec.user).forEach((k) => {
					userDefers.push((new User(spec.user[k])).save().then(function(e) {
						user[k] = e;

						// Do this here because of issues using extended mongo schema in tests
						if (k === 'explicit') {
							return TeamMember.update(
								{ _id: e._id },
								{ $addToSet: { teams: new TeamRole({ _id: team.teamWithNoExternalTeam._id, role: 'member' }) } }
								)
								.exec();
						}
					}));
				});

				return q.all(userDefers);
			});

		});

	});

	after(function() {
		return clearDatabase();
	});

	// Test implicit team membership
	describe('searchTeamMembers', () => {
		const teamsService = createSubjectUnderTest(deps);

		it('user implicitly added to a team via externalGroups', () => {
			let queryParams = { dir: 'ASC', page: '0', size: '5', sort: 'name' };

			return Team.findOne({ name: 'external' }).exec().then((team) => {
				return teamsService.searchTeamMembers(null, {}, queryParams, team).then((searchResults) => {
					(searchResults.elements).should.have.length(1);
					(searchResults.elements[0].name).should.equal('implicit Name');
				});
			});
		});

		// Test explicit team membership
		it('user explicitly added to a team through the user.teams property', () => {
			let queryParams = { dir: 'ASC', page: '0', size: '5', sort: 'name' };

			return Team.findOne({ name: 'no-external' }).exec().then(function(team) {
				return teamsService.searchTeamMembers(null, {}, queryParams, team).then((searchResults) => {
					(searchResults.elements).should.be.an.Array();
					(searchResults.elements).should.have.length(1);
					(searchResults.elements[0].name).should.equal('explicit Name');
				});
			});
		});
	});

	describe('meetsRequiredExternalTeams', () => {
		const teamsService = createSubjectUnderTest(deps);

		it('meetsRequiredExternalTeams', () => {
			let user = { bypassAccessCheck: true };
			let team = {};

			let match = teamsService.meetsRequiredExternalTeams(user, team);

			match.should.equal(true);

			user = { bypassAccessCheck: false };
			team = {};

			match = teamsService.meetsRequiredExternalTeams(user, team);

			match.should.equal(false);

			user = { bypassAccessCheck: false };
			team = { requiresExternalTeams: ['one']};

			match = teamsService.meetsRequiredExternalTeams(user, team);

			match.should.equal(false);

			user = { bypassAccessCheck: false, externalGroups: ['two'] };
			team = { requiresExternalTeams: ['one']};

			match = teamsService.meetsRequiredExternalTeams(user, team);

			match.should.equal(false);

			user = { bypassAccessCheck: false, externalGroups: ['one'] };
			team = { requiresExternalTeams: ['one']};

			match = teamsService.meetsRequiredExternalTeams(user, team);

			match.should.equal(true);

			user = { bypassAccessCheck: false, externalGroups: ['two'] };
			team = { requiresExternalTeams: ['one', 'two']};

			match = teamsService.meetsRequiredExternalTeams(user, team);

			match.should.equal(true);

			user = { bypassAccessCheck: false, externalGroups: ['two', 'four'] };
			team = { requiresExternalTeams: ['one', 'two']};

			match = teamsService.meetsRequiredExternalTeams(user, team);

			match.should.equal(true);

			user = { bypassAccessCheck: false, externalGroups: ['two', 'four'] };
			team = { requiresExternalTeams: ['four', 'one', 'two']};

			match = teamsService.meetsRequiredExternalTeams(user, team);

			match.should.equal(true);

			user = { bypassAccessCheck: false, externalGroups: ['two'] };
			team = { requiresExternalTeams: []};

			match = teamsService.meetsRequiredExternalTeams(user, team);

			match.should.equal(false);
		});
	});

	// Test team creation
	describe('createTeam', () => {
		const teamsService = createSubjectUnderTest(deps);

		it('explicit admin should be used', async () => {
			let queryParams = { dir: 'ASC', page: '0', size: '5', sort: 'name' };
			let creator = await User.findOne({ name: 'user1 Name' }).exec();
			let admin = await User.findOne({ name: 'user2 Name' }).exec();

			await teamsService.createTeam(teamSpec('test-create-2'), creator, admin, {});
			team = await Team.findOne({ name: 'test-create-2' }).exec();
			let members = await teamsService.searchTeamMembers(null, {}, queryParams, team);
			(members.elements).should.have.length(1);
			(members.elements[0]).name.should.equal(admin.name);
		});

		it('null admin should default admin to creator', async () => {
			let queryParams = {dir: 'ASC', page: '0', size: '5', sort: 'name'};
			let creator = await User.findOne({name: 'user1 Name'}).exec();

			// null admin should default to creator
			await teamsService.createTeam(teamSpec('test-create'), creator, null, {});
			let team = await Team.findOne({name: 'test-create'}).exec();
			let members = await teamsService.searchTeamMembers(null, {}, queryParams, team);
			(members.elements).should.have.length(1);
			(members.elements[0]).name.should.equal(creator.name);
		});
	});

	describe('sendRequestEmail', () => {
		it('should create mailOptions properly', async() => {
			let mailOptions = null;

			let teamsService = createSubjectUnderTest({
				// config: config,
				emailService: {
					sendMail: (mo) => {
						mailOptions = mo;
					},
					buildEmailContent: deps.emailService.buildEmailContent,
					buildEmailSubject: deps.emailService.buildEmailSubject,
					generateMailOptions: deps.emailService.generateMailOptions
				}
			});

			const user = {
				name: 'test',
				username: 'test',
				email: 'test@test.test'
			};

			const team = {
				_id: '12345',
				name: 'test team'
			};

			const toEmails = ['email1@server.com', 'email2@server.com'];

			const expectedEmailContent = `<p>Hey there <b>${team.name}</b> Admin,</p>
<p>A user named <b>${user.name}</b> with username <b>${user.username}</b> has requested access to the team.</p>
<p>Click <a href="${config.app.clientUrl}/team/${team._id}">here</a> to give them access!</p>
`;

			await teamsService.sendRequestEmail(toEmails, user, team, {});

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
			mailOptions.subject.should.equal(`${config.app.title}: A user has requested access to Team ${team.name}`);
			mailOptions.html.should.equal(expectedEmailContent);
		});
	});

	describe('requestNewTeam', () => {
		let mailOptions = null;

		let teamsService = createSubjectUnderTest({
			// config: config,
			emailService: {
				sendMail: (mo) => {
					mailOptions = mo;
				},
				buildEmailContent: deps.emailService.buildEmailContent,
				buildEmailSubject: deps.emailService.buildEmailSubject,
				getSubject: deps.emailService.getSubject,
				generateMailOptions: deps.emailService.generateMailOptions
			}
		});

		const user = new User({
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
			const expectedEmailContent = `<p>Hey there ${config.app.title} Admins,</p>
<p>A user named <b>${user.name}</b> with username <b>${user.username}</b> has requested a new team:</p>
<p>
\t<b>Organization:</b> org<br/>
\t<b>AOI:</b> aoi<br/>
\t<b>Description:</b> description<br/>
</p>
<p>Click <a href="${config.app.clientUrl}/team/create">here</a> to create this team!</p>
`;

			await teamsService.requestNewTeam('org', 'aoi', 'description', user, { headers: {} });

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
});
