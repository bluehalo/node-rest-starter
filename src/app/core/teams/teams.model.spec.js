'use strict';

const
	q = require('q'),
	should = require('should'),

	deps = require('../../../dependencies'),
	dbs = deps.dbs,

	Audit = dbs.admin.model('Audit'),
	Team = dbs.admin.model('Team'),
	TeamMember = dbs.admin.model('TeamUser'),

	teams = require('./teams.controller');

/**
 * Globals
 */
function clearDatabase() {
	return q.all([
		Audit.remove(),
		Team.remove(),
		TeamMember.remove()
	]);
}

let team1, team2, team3, team4;

let spec = {
	user1: {
		name: 'User 1',
		email: 'user1@mail.com',
		username: 'user1',
		password: 'password',
		provider: 'local'
	},
	team1: {
		name: 'Title',
		description: 'Description'
	},
	team2: {
		name: 'Title 2',
		description: 'Description 2'
	},
	team3: {
		name: 'Title 3',
		description: 'Description 3'
	},
	team4: {
		name: 'Title 4',
		description: 'Description 4'
	}
};

/**
 * Unit tests
 */
describe('Team Model:', function() {
	before(function(done) {
		return clearDatabase().then(function() {
			team1 = new Team(spec.team1);
			team2 = new Team(spec.team2);
			team3 = new Team(spec.team3);
			team4 = new Team(spec.team4);
			done();
		}, done).done();
	});

	after(function(done) {
		clearDatabase().then(function() {
			done();
		}, done).done();
	});

	describe('Method Save', function() {
		it('should begin with no teams', function(done) {
			Team.find({}).exec().then(function(teams) {
				teams.should.have.length(0);
				done();
			}, done);
		});

		it('should be able to save without problems', function(done) {
			team1.save(done);
		});


		it('should fail when trying to save without a name', function(done) {
			team1.name = '';
			team1.save(function(err) {
				should.exist(err);
				done();
			});
		});
	});

	describe('User team role', function() {
		let user1 = new TeamMember(spec.user1);

		it('should begin with no users', function(done) {
			TeamMember.find({}).exec().then(function(users) {
				users.should.have.length(0);
				done();
			}, done);
		});

		it('should create teams without problems', function(done) {
			team1.title = spec.team1.title;
			team1.save(function(err) {
				should.not.exist(err);
				should.exist(team1._id);
			});
			team2.save(function(err) {
				should.not.exist(err);
				should.exist(team2._id);
			});
			team3.save(function(err) {
				should.not.exist(err);
				should.exist(team3._id);
			});
			team4.save(function(err) {
				should.not.exist(err);
				should.exist(team4._id);
			});

			// Set some teams on the users
			user1.teams = [];
			user1.teams.push({ _id: team1.id, role: 'member' });
			user1.teams.push({ _id: team2.id, role: 'editor' });
			user1.teams.push({ _id: team3.id, role: 'admin' });

			done();
		});

		it ('should find all team members', function(done) {
			teams.getMemberTeamIds(user1)
				.then(function(ids) {
					should.exist(ids);
					ids.should.have.length(3);
					done();
				}, done).done();
		});

		it ('should find all team editors', function(done) {
			teams.getEditorTeamIds(user1)
				.then(function(ids) {
					should.exist(ids);
					ids.should.have.length(2);
					done();
				}, done).done();
		});

		it ('should find all team admins', function(done) {
			teams.getAdminTeamIds(user1)
				.then(function(ids) {
					should.exist(ids);
					ids.should.have.length(1);
					done();
				}, done).done();
		});

		it ('should filter teamIds for membership (basic)', function(done) {
			teams.filterTeamIds(user1, [ team1.id ])
				.then(function(ids) {
					should.exist(ids);
					ids.should.have.length(1);
					should(ids[0]).equal(team1.id);
					done();
				}, done).done();
		});

		it ('should filter teamIds for membership (advanced)', function(done) {
			teams.filterTeamIds(user1, [ team1.id, team2.id, team4.id ])
				.then(function(ids) {
					should.exist(ids);
					ids.should.have.length(2);
					should(ids[0]).equal(team1.id);
					should(ids[1]).equal(team2.id);
					done();
				}, done).done();
		});

		it ('should filter teamIds for membership when no access', function(done) {
			teams.filterTeamIds(user1, [ team4.id ])
				.then(function(ids) {
					should.exist(ids);
					ids.should.have.length(0);
					done();
				}, done).done();
		});

		it ('should filter teamIds for membership when no filter', function(done) {
			teams.filterTeamIds(user1)
				.then(function(ids) {
					should.exist(ids);
					ids.should.have.length(3);
					should(ids[0]).equal(team1.id);
					should(ids[1]).equal(team2.id);
					should(ids[2]).equal(team3.id);
					done();
				}, done).done();
		});

	});
});
