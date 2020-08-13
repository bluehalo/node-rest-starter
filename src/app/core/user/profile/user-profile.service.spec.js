'use strict';

const
	should = require('should'),
	userProfileService = require('./user-profile.service'),
	deps = require('../../../../dependencies'),
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

	describe('updatePreferences', () => {
		it('should update user preferences', async () => {
			// Create test user
			let user = userSpec('user1');
			await user.save();
			should.not.exist(user.preferences);

			await userProfileService.updatePreferences(user._id, {userPref1: 'value', userPref2: 'otherValue'});

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

			await userProfileService.updatePreferences(user._id, {userPref1: 'value', userPref2: 'otherValue'});

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

			await userProfileService.updateRequiredOrgs(user._id, {org1: 'value'});

			user = await User.findById(user._id);

			should.exist(user.organizationLevels);
			user.organizationLevels.should.be.Object();
			user.organizationLevels.org1.should.equal('value');
		});
	});
});
