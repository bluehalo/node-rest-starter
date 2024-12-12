import assert from 'node:assert/strict';

import { createSandbox, SinonSandbox } from 'sinon';

import userAuthorizationService from './user-authorization.service';
import { config } from '../../../../dependencies';
import { IUser, User } from '../user.model';

function userSpec(key: string) {
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
	let sandbox: SinonSandbox;

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

			assert.equal(userAuthorizationService.hasRole({} as IUser, ''), false);
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
			assert.equal(userAuthorizationService.hasRole(user, 'user'), true);
			assert.equal(userAuthorizationService.hasRole(user, 'editor'), false);
			assert.equal(userAuthorizationService.hasRole(user, 'auditor'), false);
			assert.equal(userAuthorizationService.hasRole(user, 'admin'), true);
		});

		it('should properly determine hasRole for roleStrategy = hybrid', async () => {
			const configGetStub = sandbox.stub(config, 'get');
			configGetStub.withArgs('auth.roleStrategy').returns('hybrid');
			configGetStub.callThrough();

			await reloadProvider();

			const user = new User(userSpec('hybrid'));
			user.externalRoles = ['USER'];
			user.roles = { admin: true };
			assert.equal(userAuthorizationService.hasRole(user, 'user'), true);
			assert.equal(userAuthorizationService.hasRole(user, 'editor'), false);
			assert.equal(userAuthorizationService.hasRole(user, 'auditor'), false);
			assert.equal(userAuthorizationService.hasRole(user, 'admin'), true);
		});

		it('should properly determine hasRole for roleStrategy = local', () => {
			const user = new User(userSpec('local'));
			user.roles = { user: true, editor: false, auditor: false, admin: true };
			assert.equal(userAuthorizationService.hasRole(user, 'user'), true);
			assert.equal(userAuthorizationService.hasRole(user, 'editor'), false);
			assert.equal(userAuthorizationService.hasRole(user, 'auditor'), false);
			assert.equal(userAuthorizationService.hasRole(user, 'admin'), true);
		});
	});

	describe('hasRoles', () => {
		it('should properly determine hasRoles', () => {
			const user = new User(userSpec('local'));
			user.roles = { user: true, editor: false, auditor: false, admin: true };
			assert.equal(userAuthorizationService.hasRoles(user), true);
			assert.equal(userAuthorizationService.hasRoles(user, []), true);
			assert.equal(userAuthorizationService.hasRoles(user, ['user']), true);
			assert.equal(userAuthorizationService.hasRoles(user, ['editor']), false);
			assert.equal(userAuthorizationService.hasRoles(user, ['auditor']), false);
			assert.equal(userAuthorizationService.hasRoles(user, ['admin']), true);
			assert.equal(
				userAuthorizationService.hasRoles(user, ['user', 'admin']),
				true
			);
			assert.equal(
				userAuthorizationService.hasRoles(user, ['user', 'editor']),
				false
			);
		});
	});

	describe('hasAnyRole', () => {
		it('should properly determine hasAnyRole', () => {
			const user = new User(userSpec('local'));
			user.roles = { user: true, editor: false, auditor: false, admin: true };
			assert.equal(userAuthorizationService.hasAnyRole(user), true);
			assert.equal(userAuthorizationService.hasAnyRole(user, []), true);
			assert.equal(userAuthorizationService.hasAnyRole(user, ['user']), true);
			assert.equal(
				userAuthorizationService.hasAnyRole(user, ['editor']),
				false
			);
			assert.equal(
				userAuthorizationService.hasAnyRole(user, ['auditor']),
				false
			);
			assert.equal(userAuthorizationService.hasAnyRole(user, ['admin']), true);
			assert.equal(
				userAuthorizationService.hasAnyRole(user, ['user', 'admin']),
				true
			);
			assert.equal(
				userAuthorizationService.hasAnyRole(user, ['user', 'editor']),
				true
			);
			assert.equal(
				userAuthorizationService.hasAnyRole(user, ['auditor', 'editor']),
				false
			);
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

			assert.deepStrictEqual(user, {
				roles: {
					user: true,
					elevatedRole1: true,
					elevatedRole2: false
				}
			});
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

			assert.deepStrictEqual(user, {
				roles: {
					user: true,
					elevatedRole1: false,
					elevatedRole2: true,
					admin: false
				},
				externalRoles: ['USER', 'ELEVATED_ROLE_2']
			});
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

			assert.deepStrictEqual(user, {
				roles: {
					user: true,
					elevatedRole1: true,
					elevatedRole2: true,
					admin: false
				},
				localRoles: {
					user: true,
					elevatedRole1: true,
					elevatedRole2: false
				},
				externalRoles: ['USER', 'ELEVATED_ROLE_2']
			});
		});
	});
});
