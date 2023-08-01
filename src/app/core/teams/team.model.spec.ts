import should from 'should';

import { TeamRoles } from './team-role.model';
import { TeamModel } from './team.model';
import { dbs } from '../../../dependencies';
import { AuditModel } from '../audit/audit.model';
import { UserModel } from '../user/user.model';

const Audit = dbs.admin.model('Audit') as AuditModel;
const Team = dbs.admin.model('Team') as TeamModel;
const User = dbs.admin.model('User') as UserModel;

/**
 * Globals
 */
function clearDatabase() {
	return Promise.all([
		Audit.deleteMany({}).exec(),
		Team.deleteMany({}).exec(),
		User.deleteMany({}).exec()
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
		const user1 = new User(spec.user1);

		it('should begin with no users', () => {
			return User.find({})
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
			user1.teams.push({ _id: team1.id, role: TeamRoles.Member });
			user1.teams.push({ _id: team2.id, role: TeamRoles.Editor });
			user1.teams.push({ _id: team3.id, role: TeamRoles.Admin });
		});
	});
});
