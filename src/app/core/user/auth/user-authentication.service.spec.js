'use strict';

const should = require('should'),
	sinon = require('sinon'),
	deps = require('../../../../dependencies'),
	userAuthenticationService = require('./user-authentication.service');

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
	should.exist(updatedUser.roles);
	for (const key of Object.keys(testDefaultRoles)) {
		should(updatedUser.roles[key]).equal(testDefaultRoles[key]);
	}
}

/**
 * Unit tests
 */
describe('User Authentication Service:', () => {
	let sandbox;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		sandbox.stub(deps.config, 'auth').value({ defaultRoles: testDefaultRoles });
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('initializeNewUser', () => {
		it('should set default roles when none are initially set', async () => {
			const user = userSpec('Basic');
			const updatedUser = await userAuthenticationService.initializeNewUser(
				user
			);
			validateDefaultRoles(updatedUser);
		});

		it('should set default roles when set to an empty object', async () => {
			const user = userSpec('Basic');
			user.roles = {};
			const updatedUser = await userAuthenticationService.initializeNewUser(
				user
			);
			validateDefaultRoles(updatedUser);
		});

		it('should set default roles in addition to existing', async () => {
			const user = userSpec('Basic');
			user.roles = { admin: false, editor: true };

			const updatedUser = await userAuthenticationService.initializeNewUser(
				user
			);
			validateDefaultRoles(updatedUser);
			should(updatedUser.roles.admin).equal(false);
			should(updatedUser.roles.editor).equal(true);
		});

		it('should not override existing roles', async () => {
			const user = userSpec('Basic');

			user.roles = { ...testDefaultRoles };
			// reverse the boolean value of each default role
			for (const key of Object.keys(testDefaultRoles)) {
				user.roles[key] = !user.roles[key];
			}
			user.roles.admin = false;
			user.roles.editor = true;

			const updatedUser = await userAuthenticationService.initializeNewUser(
				user
			);
			for (const key of Object.keys(testDefaultRoles)) {
				should(user.roles[key]).equal(!testDefaultRoles[key]);
			}
			should(updatedUser.roles.admin).equal(false);
			should(updatedUser.roles.editor).equal(true);
		});
	});
});
