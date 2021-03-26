'use strict';

const _ = require('lodash'),
	should = require('should'),
	proxyquire = require('proxyquire');

/**
 * Helpers
 */

const testDefaultRoles = {
	'test-role-1': true,
	'test-role-2': true,
	'test-role-3': false
};

function userSpec(key) {
	return {
		name: `${key} Name`,
		email: `${key}@mail.com`,
		username: `${key}_username`,
		password: 'password',
		provider: 'local',
		organization: `${key} Organization`
	};
}

function validateDefaultRoles(updatedUser) {
	const keys = _.keys(testDefaultRoles);

	should.exist(updatedUser.roles);

	_.forEach(keys, (key) => {
		should(updatedUser.roles[key]).equal(testDefaultRoles[key]);
	});

	return Promise.resolve(updatedUser);
}

function createSubjectUnderTest(dependencies) {
	const stubs = {};
	stubs['../../../../dependencies'] = dependencies || {};
	return proxyquire('./user-authentication.service', stubs);
}

/**
 * Unit tests
 */
describe('User Authentication Service:', () => {
	describe('initializeNewUser', () => {
		const userAuthenticationService = createSubjectUnderTest({
			config: {
				auth: {
					defaultRoles: testDefaultRoles
				}
			}
		});

		it('should set default roles when none are initially set', (done) => {
			const user = userSpec('Basic');
			userAuthenticationService
				.initializeNewUser(user)
				.then(validateDefaultRoles)
				.then(() => {
					done();
				})
				.catch(done);
		});

		it('should set default roles when set to an empty object', (done) => {
			const user = userSpec('Basic');
			user.roles = {};
			userAuthenticationService
				.initializeNewUser(user)
				.then(validateDefaultRoles)
				.then(() => {
					done();
				})
				.catch(done);
		});

		it('should set default roles in addition to existing', (done) => {
			const user = userSpec('Basic');
			user.roles = { admin: false, editor: true };
			userAuthenticationService
				.initializeNewUser(user)
				.then(validateDefaultRoles)
				.then((updatedUser) => {
					should(updatedUser.roles.admin).equal(false);
					should(updatedUser.roles.editor).equal(true);
				})
				.then(() => {
					done();
				})
				.catch(done);
		});

		it('should not override existing roles', (done) => {
			const user = userSpec('Basic');

			user.roles = _.clone(testDefaultRoles);
			// reverse the boolean value of each default role
			_.forEach(_.keys(testDefaultRoles), (key) => {
				user.roles[key] = !user.roles[key];
			});
			user.roles.admin = false;
			user.roles.editor = true;

			userAuthenticationService
				.initializeNewUser(user)
				.then((updatedUser) => {
					_.forEach(_.keys(testDefaultRoles), (key) => {
						should(user.roles[key]).equal(!testDefaultRoles[key]);
					});
					should(updatedUser.roles.admin).equal(false);
					should(updatedUser.roles.editor).equal(true);
				})
				.then(() => {
					done();
				})
				.catch(done);
		});
	});
});
