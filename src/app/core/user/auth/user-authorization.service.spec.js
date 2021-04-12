'use strict';

const should = require('should'),
	sinon = require('sinon'),
	mongoose = require('mongoose'),
	deps = require('../../../../dependencies'),
	dbs = deps.dbs,
	User = dbs.admin.model('User'),
	userAuthorizationService = require('./user-authorization.service');

function userSpec(key) {
	return {
		name: `${key} Name`,
		organization: `${key} Organization`,
		email: `${key}@mail.com`,
		username: `${key}_username`,
		password: 'password',
		provider: 'local'
	};
}

describe('User authorization service:', () => {
	let sandbox;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
	});

	afterEach(() => {
		sandbox.restore();
	});

	/**
	 * Unit tests
	 */
	describe('getProvider', () => {
		it('should throw error is no provider is configured', () => {
			sandbox.stub(deps.config.auth, 'roleStrategy').value('external');
			sandbox.stub(deps.config.auth, 'externalRoles').value({});

			should(() => {
				userAuthorizationService.hasRole({}, '');
			}).throw('No externalRoles provider configuration found.');
		});

		it('should throw error is not provider is configured2', () => {
			sandbox.stub(deps.config.auth, 'roleStrategy').value('external');
			sandbox.stub(deps.config.auth, 'externalRoles').value({
				provider: {
					file: './does-not-exist.js'
				}
			});

			should(() => {
				userAuthorizationService.hasRole({}, '');
			}).throw(/Cannot find module/);
		});
	});

	describe('hasRole', () => {
		it('should properly determine hasRole for roleStrategy = external', () => {
			sandbox.stub(deps.config.auth, 'roleStrategy').value('external');

			const user = new User(userSpec('external'));
			user.externalRoles = ['USER', 'ADMIN'];
			should(userAuthorizationService.hasRole(user, 'user')).be.true();
			should(userAuthorizationService.hasRole(user, 'editor')).be.false();
			should(userAuthorizationService.hasRole(user, 'auditor')).be.false();
			should(userAuthorizationService.hasRole(user, 'admin')).be.true();
		});

		it('should properly determine hasRole for roleStrategy = hybrid', () => {
			sandbox.stub(deps.config.auth, 'roleStrategy').value('hybrid');

			const user = new User(userSpec('hybrid'));
			user.externalRoles = ['USER'];
			user.roles = { admin: true };
			should(userAuthorizationService.hasRole(user, 'user')).be.true();
			should(userAuthorizationService.hasRole(user, 'editor')).be.false();
			should(userAuthorizationService.hasRole(user, 'auditor')).be.false();
			should(userAuthorizationService.hasRole(user, 'admin')).be.true();
		});

		it('should properly determine hasRole for roleStrategy = local', () => {
			const user = new User(userSpec('local'));
			user.roles = { user: true, editor: false, auditor: false, admin: true };
			should(userAuthorizationService.hasRole(user, 'user')).be.true();
			should(userAuthorizationService.hasRole(user, 'editor')).be.false();
			should(userAuthorizationService.hasRole(user, 'auditor')).be.false();
			should(userAuthorizationService.hasRole(user, 'admin')).be.true();
		});
	});

	describe('hasRoles', () => {
		it('should properly determine hasRoles', () => {
			const user = new User(userSpec('local'));
			user.roles = { user: true, editor: false, auditor: false, admin: true };
			should(userAuthorizationService.hasRoles(user)).be.true();
			should(userAuthorizationService.hasRoles(user, [])).be.true();
			should(userAuthorizationService.hasRoles(user, ['user'])).be.true();
			should(userAuthorizationService.hasRoles(user, ['editor'])).be.false();
			should(userAuthorizationService.hasRoles(user, ['auditor'])).be.false();
			should(userAuthorizationService.hasRoles(user, ['admin'])).be.true();
			should(
				userAuthorizationService.hasRoles(user, ['user', 'admin'])
			).be.true();
			should(
				userAuthorizationService.hasRoles(user, ['user', 'editor'])
			).be.false();
		});
	});

	describe('hasAnyRole', () => {
		it('should properly determine hasAnyRole', () => {
			const user = new User(userSpec('local'));
			user.roles = { user: true, editor: false, auditor: false, admin: true };
			should(userAuthorizationService.hasAnyRole(user)).be.true();
			should(userAuthorizationService.hasAnyRole(user, [])).be.true();
			should(userAuthorizationService.hasAnyRole(user, ['user'])).be.true();
			should(userAuthorizationService.hasAnyRole(user, ['editor'])).be.false();
			should(userAuthorizationService.hasAnyRole(user, ['auditor'])).be.false();
			should(userAuthorizationService.hasAnyRole(user, ['admin'])).be.true();
			should(
				userAuthorizationService.hasAnyRole(user, ['user', 'admin'])
			).be.true();
			should(
				userAuthorizationService.hasAnyRole(user, ['user', 'editor'])
			).be.true();
			should(
				userAuthorizationService.hasAnyRole(user, ['auditor', 'editor'])
			).be.false();
		});
	});

	describe('updateRoles', () => {
		it('roleStrategy === local; should pass through roles as is', () => {
			sandbox.stub(deps.config.auth, 'roleStrategy').value('local');
			sandbox
				.stub(deps.config.auth, 'roles')
				.value(['user', 'elevatedRole1', 'elevatedRole2']);

			const user = {
				roles: {
					user: true,
					elevatedRole1: true,
					elevatedRole2: false
				}
			};

			userAuthorizationService.updateRoles(user);

			user.should.be.an.Object();
			user.roles.should.be.an.Object();
			user.roles.user.should.be.true();
			user.roles.elevatedRole1.should.be.true();
			user.roles.elevatedRole2.should.be.false();

			should.not.exist(user.localRoles);
		});

		it('roleStrategy === external; should pass through roles as is', () => {
			sandbox.stub(deps.config.auth, 'roleStrategy').value('external');
			sandbox
				.stub(deps.config.auth, 'roles')
				.value(['user', 'elevatedRole1', 'elevatedRole2', 'admin']);
			sandbox.stub(deps.config.auth, 'externalRoles').value({
				provider: {
					file: 'src/app/core/user/auth/external-role-map.provider.js',
					config: {
						externalRoleMap: {
							user: 'USER',
							elevatedRole1: 'ELEVATED_ROLE_1',
							elevatedRole2: 'ELEVATED_ROLE_2',
							admin: 'ADMIN'
						}
					}
				}
			});

			const user = {
				roles: {
					user: true,
					elevatedRole1: true,
					elevatedRole2: false
				},
				externalRoles: ['USER', 'ELEVATED_ROLE_2']
			};

			userAuthorizationService.updateRoles(user);

			user.should.be.an.Object();
			user.roles.should.be.an.Object();
			user.roles.user.should.be.true();
			user.roles.elevatedRole1.should.be.false();
			user.roles.elevatedRole2.should.be.true();

			should.not.exist(user.localRoles);
		});

		it('roleStrategy === hybrid; should pass through roles as is', () => {
			sandbox.stub(deps.config.auth, 'roleStrategy').value('hybrid');
			sandbox
				.stub(deps.config.auth, 'roles')
				.value(['user', 'elevatedRole1', 'elevatedRole2', 'admin']);
			sandbox.stub(deps.config.auth, 'externalRoles').value({
				provider: {
					file: 'src/app/core/user/auth/external-role-map.provider.js',
					config: {
						externalRoleMap: {
							user: 'USER',
							elevatedRole1: 'ELEVATED_ROLE_1',
							elevatedRole2: 'ELEVATED_ROLE_2',
							admin: 'ADMIN'
						}
					}
				}
			});

			const user = {
				roles: {
					user: true,
					elevatedRole1: true,
					elevatedRole2: false
				},
				externalRoles: ['USER', 'ELEVATED_ROLE_2']
			};

			userAuthorizationService.updateRoles(user);

			user.should.be.an.Object();
			user.roles.should.be.an.Object();
			user.roles.user.should.be.true();
			user.roles.elevatedRole1.should.be.true();
			user.roles.elevatedRole2.should.be.true();
			user.roles.admin.should.be.false();

			user.localRoles.should.be.an.Object();
			user.localRoles.user.should.be.true();
			user.localRoles.elevatedRole1.should.be.true();
			user.localRoles.elevatedRole2.should.be.false();
		});
	});

	describe('validateAccessToPersonalResource', () => {
		const id1 = mongoose.Types.ObjectId();
		const id2 = mongoose.Types.ObjectId();

		it('test user (not admin) access own resource', () => {
			const user = { roles: { admin: false }, _id: id1 };
			const resource = { creator: id1 };

			return userAuthorizationService
				.validateAccessToPersonalResource(user, resource)
				.should.be.fulfilled();
		});

		it('test user (not admin) access another user resource', () => {
			const user = { roles: { admin: false }, _id: id1 };
			const resource = { creator: id2 };

			return userAuthorizationService
				.validateAccessToPersonalResource(user, resource)
				.should.be.rejected();
		});

		it('test user with no roles access own resource', () => {
			const user = { _id: id1 };
			const resource = { creator: id1 };

			return userAuthorizationService
				.validateAccessToPersonalResource(user, resource)
				.should.be.fulfilled();
		});

		it('test user with no roles access another user resource', () => {
			const user = { _id: id1 };
			const resource = { creator: id2 };

			return userAuthorizationService
				.validateAccessToPersonalResource(user, resource)
				.should.be.rejected();
		});

		it('test admin access own resource', () => {
			const user = { roles: { admin: true }, _id: id1 };
			const resource = { creator: id1 };

			return userAuthorizationService
				.validateAccessToPersonalResource(user, resource)
				.should.be.fulfilled();
		});

		it('test admin access another user resource', () => {
			const user = { roles: { admin: true }, _id: id1 };
			const resource = { creator: id2 };

			return userAuthorizationService
				.validateAccessToPersonalResource(user, resource)
				.should.be.fulfilled();
		});
	});
});
