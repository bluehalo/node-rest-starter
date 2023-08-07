import should from 'should';

import { UserModel } from './user.model';
import userService from './user.service';
import { dbs } from '../../../dependencies';

const User = dbs.admin.model('User') as UserModel;

/**
 * Helpers
 */

function userSpec(key) {
	return new User({
		name: `${key} Name`,
		email: `${key}@mail.com`,
		username: `${key}_username`,
		password: 'password',
		provider: 'local',
		organization: `${key} Organization`
	});
}

/**
 * Unit tests
 */
describe('User Profile Service:', () => {
	beforeEach(async () => {
		await User.deleteMany().exec();
	});

	afterEach(async () => {
		await User.deleteMany().exec();
	});

	describe('read', () => {
		it('should return user by id', async () => {
			// Create test user
			let user = userSpec('user1');
			await user.save();

			user = await userService.read(user._id);
			should.exist(user);
			user.name.should.equal('user1 Name');
		});

		it('read returns null for invalid id', async () => {
			const user = await userService.read('5cc9db5f738d4a7198466bc0');
			should.not.exist(user);
		});
	});

	describe('update', () => {
		it('publish date is set on user', async () => {
			// Create user
			let user = userSpec('user1');
			await user.save();

			// Update user
			Object.assign(user, { name: 'New Name', email: 'new@email.email' });
			user = await userService.update(user);
			user.name.should.equal('New Name');
			user.email.should.equal('new@email.email');

			// re-query and verify update
			user = await User.findById(user._id);
			should.exist(user);
			user.name.should.equal('New Name');
			user.email.should.equal('new@email.email');
		});
	});

	describe('remove', () => {
		it('user is removed', async () => {
			// Create user
			let user = userSpec('user1');

			await user.save();

			// Verify user is in db
			user = await User.findById(user._id);
			should.exist(user);

			// Remove user
			await userService.remove(user);

			// Verify user is no longer in db
			user = await User.findById(user._id);
			should.not.exist(user);
		});
	});

	describe('searchUsers', () => {
		beforeEach(async () => {
			const users = [...Array(100).keys()].map((index) =>
				userSpec(`user${index}`)
			);

			await User.insertMany(users);
		});

		it('search results page returned', async () => {
			const queryParams = { size: 10 };
			const query = null;
			const search = '';

			const result = await userService.searchUsers(queryParams, query, search);

			should.exist(result);
			result.totalSize.should.equal(100);
			result.pageSize.should.equal(queryParams.size);
			result.pageNumber.should.equal(0);
			result.totalPages.should.equal(100 / queryParams.size);
			result.elements.should.be.an.Array();
			result.elements.length.should.be.equal(queryParams.size);
		});

		it('search (w/ searchFields) results page returned', async () => {
			const queryParams = { size: 10 };
			const query = null;
			const search = '';

			const result = await userService.searchUsers(queryParams, query, search, [
				'field1'
			]);

			should.exist(result);
			result.totalSize.should.equal(100);
			result.pageSize.should.equal(queryParams.size);
			result.pageNumber.should.equal(0);
			result.totalPages.should.equal(100 / queryParams.size);
			result.elements.should.be.an.Array();
			result.elements.length.should.be.equal(queryParams.size);
		});
	});

	describe('updatePreferences', () => {
		it('should update user preferences', async () => {
			// Create test user
			let user = userSpec('user1');
			await user.save();
			should.not.exist(user.preferences);

			await userService.updatePreferences(user, {
				userPref1: 'value',
				userPref2: 'otherValue'
			});

			user = await User.findById(user._id);

			should.exist(user.preferences);
			user.preferences.userPref1.should.equal('value');
			user.preferences.userPref2.should.equal('otherValue');
		});

		it('should merge user preferences', async () => {
			// Create test user
			let user = new User({
				name: 'Name',
				email: 'user@mail.com',
				username: 'username',
				organization: 'Organization',
				provider: 'local',
				password: 'password',
				preferences: { userPref1: 'oldValue', userPref3: 'oldValue' }
			});
			await user.save();
			should.exist(user.preferences);
			user.preferences.userPref1.should.equal('oldValue');
			user.preferences.userPref3.should.equal('oldValue');

			await userService.updatePreferences(user, {
				userPref1: 'value',
				userPref2: 'otherValue'
			});

			user = await User.findById(user._id);

			should.exist(user.preferences);
			user.preferences.userPref1.should.equal('value');
			user.preferences.userPref2.should.equal('otherValue');
			user.preferences.userPref3.should.equal('oldValue');
		});
	});

	describe('updateRequiredOrgs', () => {
		it('should update organizationLevels', async () => {
			// Create test user
			let user = new User({
				name: 'Name',
				email: 'user@mail.com',
				username: 'username',
				organization: 'Organization',
				provider: 'local',
				password: 'password'
			});
			await user.save();
			should.not.exist(user.organizationLevels);

			await userService.updateRequiredOrgs(user, { org1: 'value' });

			user = await User.findById(user._id);

			should.exist(user.organizationLevels);
			user.organizationLevels.should.be.Object();
			user.organizationLevels.org1.should.equal('value');
		});
	});
});
