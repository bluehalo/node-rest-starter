'use strict';

const
	mongoose = require('mongoose'),
	should = require('should'),
	userService = require('./user.service'),
	deps = require('../../../dependencies'),
	User = deps.dbs.admin.model('User');

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
			const user = await userService.read(mongoose.Types.ObjectId('5cc9db5f738d4a7198466bc0'));
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
			const users = [...Array(100).keys()].map((index) => userSpec(`user${index}`));

			await User.insertMany(users);
		});

		it('search results page returned', async () => {
			const queryParams = {size: 10};
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
			const queryParams = {size: 10};
			const query = null;
			const search = '';

			const result = await userService.searchUsers(queryParams, query, search, ['field1']);

			should.exist(result);
			result.totalSize.should.equal(100);
			result.pageSize.should.equal(queryParams.size);
			result.pageNumber.should.equal(0);
			result.totalPages.should.equal(100 / queryParams.size);
			result.elements.should.be.an.Array();
			result.elements.length.should.be.equal(queryParams.size);
		});
	});
});
