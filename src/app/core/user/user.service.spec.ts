import assert from 'node:assert/strict';

import { User } from './user.model';
import userService from './user.service';

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
			assert(user);
			assert.equal(user.name, 'user1 Name');
		});

		it('read returns null for invalid id', async () => {
			const user = await userService.read('5cc9db5f738d4a7198466bc0');
			assert.equal(user, null);
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
			assert.equal(user.name, 'New Name');
			assert.equal(user.email, 'new@email.email');

			// re-query and verify update
			user = await User.findById(user._id);
			assert(user);
			assert.equal(user.name, 'New Name');
			assert.equal(user.email, 'new@email.email');
		});
	});

	describe('remove', () => {
		it('user is removed', async () => {
			// Create user
			let user = userSpec('user1');

			await user.save();

			// Verify user is in db
			user = await User.findById(user._id);
			assert(user);

			// Remove user
			await userService.remove(user);

			// Verify user is no longer in db
			user = await User.findById(user._id);
			assert.equal(user, null);
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

			const { elements, ...result } = await userService.searchUsers(
				queryParams,
				query,
				search
			);

			assert.deepStrictEqual(result, {
				totalSize: 100,
				pageSize: queryParams.size,
				pageNumber: 0,
				totalPages: 100 / queryParams.size
			});
			assert(Array.isArray(elements), 'elements should be an Array');
			assert.equal(elements.length, queryParams.size);
		});

		it('search (w/ searchFields) results page returned', async () => {
			const queryParams = { size: 10 };
			const query = null;
			const search = '';

			const { elements, ...result } = await userService.searchUsers(
				queryParams,
				query,
				search,
				['field1']
			);

			assert.deepStrictEqual(result, {
				totalSize: 100,
				pageSize: queryParams.size,
				pageNumber: 0,
				totalPages: 100 / queryParams.size
			});
			assert(Array.isArray(elements), 'elements should be an Array');
			assert.equal(elements.length, queryParams.size);
		});
	});

	describe('updatePreferences', () => {
		it('should update user preferences', async () => {
			// Create test user
			let user = userSpec('user1');
			await user.save();
			assert.equal(user.preferences, undefined);

			await userService.updatePreferences(user, {
				userPref1: 'value',
				userPref2: 'otherValue'
			});

			user = await User.findById(user._id);

			assert(user.preferences);
			assert.equal(user.preferences.userPref1, 'value');
			assert.equal(user.preferences.userPref2, 'otherValue');
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
			assert(user.preferences);
			assert.equal(user.preferences.userPref1, 'oldValue');
			assert.equal(user.preferences.userPref3, 'oldValue');

			await userService.updatePreferences(user, {
				userPref1: 'value',
				userPref2: 'otherValue'
			});

			user = await User.findById(user._id);

			assert(user.preferences);
			assert.equal(user.preferences.userPref1, 'value');
			assert.equal(user.preferences.userPref2, 'otherValue');
			assert.equal(user.preferences.userPref3, 'oldValue');
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
			assert.equal(user.organizationLevels, undefined);

			await userService.updateRequiredOrgs(user, { org1: 'value' });

			user = await User.findById(user._id);

			assert.equal(typeof user.organizationLevels, 'object');
			assert.equal(user.organizationLevels.org1, 'value');
		});
	});
});
