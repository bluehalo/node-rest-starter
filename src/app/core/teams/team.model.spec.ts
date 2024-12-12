import assert from 'node:assert/strict';

import { TeamRoles } from './team-role.model';
import { Team, TeamDocument } from './team.model';
import { Audit } from '../audit/audit.model';
import { User } from '../user/user.model';

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

let team1: TeamDocument;
let team2: TeamDocument;
let team3: TeamDocument;
let team4: TeamDocument;

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
			assert.deepStrictEqual(teams, []);
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
				assert(err);
			}
		});
	});

	describe('User team role', () => {
		const user1 = new User(spec.user1);

		it('should begin with no users', async () => {
			const users = await User.find({}).exec();
			assert.deepStrictEqual(users, []);
		});

		it('should create teams without problems', async () => {
			await assert.doesNotReject(team1.save());
			assert(team1._id);

			await assert.doesNotReject(team2.save());
			assert(team2._id);

			await assert.doesNotReject(team3.save());
			assert(team3._id);

			await assert.doesNotReject(team4.save());
			assert(team4._id);

			// Set some teams on the users
			user1.teams = [];
			user1.teams.push({ _id: team1.id, role: TeamRoles.Member });
			user1.teams.push({ _id: team2.id, role: TeamRoles.Editor });
			user1.teams.push({ _id: team3.id, role: TeamRoles.Admin });
		});
	});
});
