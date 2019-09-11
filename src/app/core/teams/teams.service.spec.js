'use strict';

const
	_ = require('lodash'),
	q = require('q'),
	should = require('should'),

	deps = require('../../../dependencies'),
	dbs = deps.dbs,

	User = dbs.admin.model('User'),
	Team = dbs.admin.model('Team'),
	TeamMember = dbs.admin.model('TeamUser'),
	TeamRole = dbs.admin.model('TeamRole'),

	teamsService = require('./teams.service')();


/**
 * Helpers
 */

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
	it('Search team membership; user implicitly added to a team via externalGroups', () => {
		let queryParams = { dir: 'ASC', page: '0', size: '5', sort: 'name' };

		return Team.findOne({ name: 'external' }).exec().then((team) => {
			return teamsService.searchTeamMembers(null, {}, queryParams, team).then((searchResults) => {
				(searchResults.elements).should.have.length(1);
				(searchResults.elements[0].name).should.equal('implicit Name');
			});
		});
	});

	// Test explicit team membership
	it('Search team membership; user explicitly added to a team through the user.teams property', () => {
		let queryParams = { dir: 'ASC', page: '0', size: '5', sort: 'name' };

		return Team.findOne({ name: 'no-external' }).exec().then(function(team) {
			return teamsService.searchTeamMembers(null, {}, queryParams, team).then((searchResults) => {
				(searchResults.elements).should.be.an.Array();
				(searchResults.elements).should.have.length(1);
				(searchResults.elements[0].name).should.equal('explicit Name');
			});
		});
	});

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


	// Test team creation
	it('team set admin on create', async () => {
		let queryParams = { dir: 'ASC', page: '0', size: '5', sort: 'name' };
		let creator = await User.findOne({ name: 'user1 Name' }).exec();
		let admin = await User.findOne({ name: 'user2 Name' }).exec();

		// null admin should default to creator
		await teamsService.createTeam(teamSpec('test-create'), creator, null, {});
		let team = await Team.findOne({ name: 'test-create' }).exec();
		let members = await teamsService.searchTeamMembers(null, {}, queryParams, team);
		(members.elements).should.have.length(1);
		(members.elements[0]).name.should.equal(creator.name);

		await teamsService.createTeam(teamSpec('test-create-2'), creator, admin, {});
		team = await Team.findOne({ name: 'test-create-2' }).exec();
		members = await teamsService.searchTeamMembers(null, {}, queryParams, team);
		(members.elements).should.have.length(1);
		(members.elements[0]).name.should.equal(admin.name);
	});
});
