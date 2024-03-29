import mongoose from 'mongoose';
import should from 'should';
import { createSandbox } from 'sinon';

import userAuthorizationService from './user-authorization.service';
import { config } from '../../../../dependencies';
import { IUser, User } from '../user.model';
import userService from '../user.service';

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

	const reloadProvider = () => {
		return userAuthorizationService
			.loadProvider(true)
			.then(
				() => {
					//empty callback
				},
				() => {
					//ignore error
				}
			)
			.catch();
	};

	beforeEach(() => {
		sandbox = createSandbox();
	});

	afterEach(async () => {
		sandbox.restore();
		await reloadProvider();
	});

	/**
	 * Unit tests
	 */
	describe('getProvider', () => {
		it('should return false if invalid provider is configured', async () => {
			const configGetStub = sandbox.stub(config, 'get');
			configGetStub.withArgs('auth.roleStrategy').returns('external');
			configGetStub.withArgs('auth.externalRoles').returns({
				provider: {
					file: './does-not-exist.js'
				}
			});
			configGetStub.callThrough();

			await reloadProvider();

			should(userAuthorizationService.hasRole({} as IUser, '')).be.false();
		});
	});

	describe('hasRole', () => {
		it('should properly determine hasRole for roleStrategy = external', async () => {
			const configGetStub = sandbox.stub(config, 'get');
			configGetStub.withArgs('auth.roleStrategy').returns('external');
			configGetStub.callThrough();

			await reloadProvider();

			const user = new User(userSpec('external'));
			user.externalRoles = ['USER', 'ADMIN'];
			should(userAuthorizationService.hasRole(user, 'user')).be.true();
			should(userAuthorizationService.hasRole(user, 'editor')).be.false();
			should(userAuthorizationService.hasRole(user, 'auditor')).be.false();
			should(userAuthorizationService.hasRole(user, 'admin')).be.true();
		});

		it('should properly determine hasRole for roleStrategy = hybrid', async () => {
			const configGetStub = sandbox.stub(config, 'get');
			configGetStub.withArgs('auth.roleStrategy').returns('hybrid');
			configGetStub.callThrough();

			await reloadProvider();

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
		it('roleStrategy === local; should pass through roles as is', async () => {
			const configGetStub = sandbox.stub(config, 'get');
			configGetStub.withArgs('auth.roleStrategy').returns('local');
			configGetStub
				.withArgs('auth.roles')
				.returns(['user', 'elevatedRole1', 'elevatedRole2']);
			configGetStub.callThrough();

			await reloadProvider();

			const user: {
				roles: Record<string, boolean>;
				localRoles?: Record<string, boolean>;
				externalRoles?: string[];
			} = {
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

		it('roleStrategy === external; should pass through roles as is', async () => {
			const configGetStub = sandbox.stub(config, 'get');
			configGetStub.withArgs('auth.roleStrategy').returns('external');
			configGetStub
				.withArgs('auth.roles')
				.returns(['user', 'elevatedRole1', 'elevatedRole2', 'admin']);
			configGetStub
				.withArgs('auth.externalRoles.provider.file')
				.returns('src/app/core/user/auth/default-external-role-map.provider');
			configGetStub.withArgs('auth.externalRoles.provider.config').returns({
				externalRoleMap: {
					user: 'USER',
					elevatedRole1: 'ELEVATED_ROLE_1',
					elevatedRole2: 'ELEVATED_ROLE_2',
					admin: 'ADMIN'
				}
			});
			configGetStub.callThrough();

			await reloadProvider();

			const user: {
				roles: Record<string, boolean>;
				localRoles?: Record<string, boolean>;
				externalRoles: string[];
			} = {
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

		it('roleStrategy === hybrid; should pass through roles as is', async () => {
			const configGetStub = sandbox.stub(config, 'get');
			configGetStub.withArgs('auth.roleStrategy').returns('hybrid');
			configGetStub
				.withArgs('auth.roles')
				.returns(['user', 'elevatedRole1', 'elevatedRole2', 'admin']);
			configGetStub
				.withArgs('auth.externalRoles.provider.file')
				.returns('src/app/core/user/auth/default-external-role-map.provider');
			configGetStub.withArgs('auth.externalRoles.provider.config').returns({
				externalRoleMap: {
					user: 'USER',
					elevatedRole1: 'ELEVATED_ROLE_1',
					elevatedRole2: 'ELEVATED_ROLE_2',
					admin: 'ADMIN'
				}
			});
			configGetStub.callThrough();

			await reloadProvider();

			const user: {
				roles: Record<string, boolean>;
				localRoles?: Record<string, boolean>;
				externalRoles: string[];
			} = {
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
		const id1 = new mongoose.Types.ObjectId();
		const id2 = new mongoose.Types.ObjectId();

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
