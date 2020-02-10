'use strict';

const
	should = require('should'),

	deps = require('../../../dependencies'),
	dbs = deps.dbs,

	Audit = dbs.admin.model('Audit'),
	Team = dbs.admin.model('Team'),
	TeamMember = dbs.admin.model('TeamUser');

/**
 * Globals
 */
function clearDatabase() {
	return Promise.all([
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
	before(async () => {
		await clearDatabase();
		team1 = new Team(spec.team1);
		team2 = new Team(spec.team2);
		team3 = new Team(spec.team3);
		team4 = new Team(spec.team4);
	});

	after(async () => {
		await clearDatabase();
	});

	describe('Method Save', function() {
		it('should begin with no teams', async () => {
			let teams = await Team.find({}).exec();
			teams.should.have.length(0);
		});

		it('should be able to save without problems', async () => {
			await team1.save();
		});

		it('should fail when trying to save without a name', async () => {
			let team = new Team(spec.team1);
			team.name = '';
			try {
				team.save();
			} catch(err) {
				should.exist(err);
			}
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
	});
});
