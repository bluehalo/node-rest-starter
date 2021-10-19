'use strict';

const should = require('should'),
	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	Audit = dbs.admin.model('Audit'),
	Team = dbs.admin.model('Team'),
	TeamMember = dbs.admin.model('TeamUser');

const { spy } = require('sinon');

/**
 * Globals
 */
function clearDatabase() {
	return Promise.all([
		Audit.deleteMany({}).exec(),
		Team.deleteMany({}).exec(),
		TeamMember.deleteMany({}).exec()
	]);
}

let team1, team2, team3, team4;

const spec = {
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
describe('Team Model:', () => {
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

	describe('Method Save', () => {
		it('should begin with no teams', async () => {
			const teams = await Team.find({}).exec();
			teams.should.have.length(0);
		});

		it('should be able to save without problems', async () => {
			await team1.save();
		});

		it('should fail when trying to save without a name', async () => {
			const team = new Team(spec.team1);
			team.name = '';
			try {
				return await team.save();
			} catch (err) {
				should.exist(err);
			}
		});
	});

	describe('User team role', () => {
		const user1 = new TeamMember(spec.user1);

		it('should begin with no users', () => {
			return TeamMember.find({})
				.exec()
				.then((users) => {
					users.should.have.length(0);
				});
		});

		it('should create teams without problems', async () => {
			await team1.save((err) => {
				should.not.exist(err);
				should.exist(team1._id);
			});
			await team2.save((err) => {
				should.not.exist(err);
				should.exist(team2._id);
			});
			await team3.save((err) => {
				should.not.exist(err);
				should.exist(team3._id);
			});
			await team4.save((err) => {
				should.not.exist(err);
				should.exist(team4._id);
			});

			// Set some teams on the users
			user1.teams = [];
			user1.teams.push({ _id: team1.id, role: 'member' });
			user1.teams.push({ _id: team2.id, role: 'editor' });
			user1.teams.push({ _id: team3.id, role: 'admin' });
		});

		describe('Static methods', () => {
			describe('teamCopy', () => {
				it('should return null if passed null', () => {
					should(TeamMember.teamCopy(null)).be.null();
				});
				it('should defer to user filteredCopy', () => {
					const filteredSpy = spy(dbs.admin.model('User'), 'filteredCopy');
					const teams = [1, 2, 3];
					const user = {
						_id: 'test',
						name: 'test',
						organizationLevels: 1,
						username: 'test',
						password: 'sneaky',
						teams
					};
					const copy = TeamMember.teamCopy(user);
					should(filteredSpy.calledWith(user)).be.true();
					// Check for sensitive info & clean expectation.
					should(copy.password).be.undefined();
					delete user.password;
					should(copy).be.eql(user);
				});
			});
		});
	});
});
