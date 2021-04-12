'use strict';

const mock = require('mock-require'),
	should = require('should');

/**
 * Unit tests
 */
describe('User Controller:', () => {
	const pass = (msg) => {
		return () => {
			return Promise.resolve(msg);
		};
	};
	const fail = (msg) => {
		return () => {
			return Promise.reject({ message: msg });
		};
	};

	describe('hasAccess', () => {
		afterEach(() => {
			mock.stopAll();
		});

		it('should allow a user with all access', (done) => {
			mock('./auth/user-authorization.controller', {
				requiresLogin: pass('login'),
				requiresOrganizationLevels: pass('org'),
				requiresUserRole: pass('user'),
				requiresExternalRoles: pass('external')
			});
			mock('./eua/eua.controller', {
				requiresEua: pass('eua')
			});
			const ctrl = mock.reRequire('./user.controller');
			ctrl.hasAccess({}, {}, done);
		});

		it('should fail a user without eua access', (done) => {
			mock('./auth/user-authorization.controller', {
				requiresLogin: pass('login'),
				requiresOrganizationLevels: pass('org'),
				requiresUserRole: pass('user'),
				requiresExternalRoles: pass('external')
			});
			mock('./eua/eua.controller', {
				requiresEua: fail('eua')
			});
			const ctrl = mock.reRequire('./user.controller');
			ctrl.hasAccess(
				{},
				{
					status: () => {
						return {
							json: (actual) => {
								should(actual.message).eql('eua');
								done();
							}
						};
					}
				},
				() => {
					done('should not get here');
				}
			);
		});

		it('should fail a user without user role access', (done) => {
			mock('./auth/user-authorization.controller', {
				requiresLogin: pass('login'),
				requiresOrganizationLevels: pass('org'),
				requiresUserRole: fail('user'),
				requiresExternalRoles: pass('external')
			});
			mock('./eua/eua.controller', {
				requiresEua: pass('eua')
			});
			const ctrl = mock.reRequire('./user.controller');
			ctrl.hasAccess(
				{},
				{
					status: () => {
						return {
							json: (actual) => {
								should(actual.message).eql('user');
								done();
							}
						};
					}
				},
				() => {
					done('should not get here');
				}
			);
		});

		it('should fail first on user role even if eua is missing', (done) => {
			mock('./auth/user-authorization.controller', {
				requiresLogin: pass('login'),
				requiresOrganizationLevels: pass('org'),
				requiresUserRole: fail('user'),
				requiresExternalRoles: pass('external')
			});
			mock('./eua/eua.controller', {
				requiresEua: fail('eua')
			});
			const ctrl = mock.reRequire('./user.controller');
			ctrl.hasAccess(
				{},
				{
					status: () => {
						return {
							json: (actual) => {
								should(actual.message).eql('user');
								done();
							}
						};
					}
				},
				() => {
					done('should not get here');
				}
			);
		});
	});
});
