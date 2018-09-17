'use strict';

const
	_ = require('lodash'),
	q = require('q'),
	should = require('should'),

	deps = require('../../../../dependencies'),
	config = deps.config,

	userAuthenticationService = require('./user-authentication.service');

/**
 * Helpers
 */

let testDefaultRoles = {
	'test-role-1': true,
	'test-role-2': true,
	'test-role-3': false
};

function userSpec(key) {
	return {
		name: key + ' Name',
		email: key + '@mail.com',
		username: key + '_username',
		password: 'password',
		provider: 'local',
		organization: key + ' Organization'
	};
}

function validateDefaultRoles(updatedUser) {
	let keys = _.keys(testDefaultRoles);

	should.exist(updatedUser.roles);

	_.forEach(keys, (key) => {
		should(updatedUser.roles[key]).equal(testDefaultRoles[key]);
	});

	return q(updatedUser);

}

/**
 * Unit tests
 */
describe('User Authentication Service:', () => {

	let originalDefaultRoles;

	before(() => {
		originalDefaultRoles = config.auth.defaultRoles;
		config.auth.defaultRoles = testDefaultRoles;
	});

	after(() => {
		config.auth.defaultRoles = originalDefaultRoles;
	});

	describe('initializeNewUser', () => {

		it('should set default roles when none are initially set', (done) => {
			let user = userSpec('Basic');
			userAuthenticationService.initializeNewUser(user)
				.then(validateDefaultRoles)
				.then(() => { done(); })
				.catch(done);
		});

		it('should set default roles when set to an empty object', (done) => {
			let user = userSpec('Basic');
			user.roles = {};
			userAuthenticationService.initializeNewUser(user)
				.then(validateDefaultRoles)
				.then(() => { done(); })
				.catch(done);
		});

		it('should set default roles in addition to existing', (done) => {
			let user = userSpec('Basic');
			user.roles = { admin: false, editor: true };
			userAuthenticationService.initializeNewUser(user)
				.then(validateDefaultRoles)
				.then((updatedUser) => {
					should(updatedUser.roles.admin).equal(false);
					should(updatedUser.roles.editor).equal(true);
				})
				.then(() => { done(); })
				.catch(done);
		});

		it('should not override existing roles', (done) => {
			let user = userSpec('Basic');

			user.roles = _.clone(testDefaultRoles);
			// reverse the boolean value of each default role
			_.forEach(_.keys(testDefaultRoles), (key) => {
				user.roles[key] = !user.roles[key];
			});
			user.roles.admin = false;
			user.roles.editor = true;

			userAuthenticationService.initializeNewUser(user)
				.then((updatedUser) => {
					_.forEach(_.keys(testDefaultRoles), (key) => {
						should(user.roles[key]).equal(!testDefaultRoles[key]);
					});
					should(updatedUser.roles.admin).equal(false);
					should(updatedUser.roles.editor).equal(true);
				})
				.then(() => { done(); })
				.catch(done);
		});

	});

});
