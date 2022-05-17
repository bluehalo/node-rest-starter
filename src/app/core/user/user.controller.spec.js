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
			ctrl.hasAccess({}, {}, (err) => {
				should.exist(err);
				err.message.should.equal('eua');
				done();
			});
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
			ctrl.hasAccess({}, {}, (err) => {
				should.exist(err);
				err.message.should.equal('user');
				done();
			});
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
			ctrl.hasAccess({}, {}, (err) => {
				should.exist(err);
				err.message.should.equal('user');
				done();
			});
		});
	});
});
