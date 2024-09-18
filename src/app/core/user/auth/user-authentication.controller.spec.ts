import assert from 'node:assert/strict';

import _ from 'lodash';
import { DateTime } from 'luxon';
import passport from 'passport';
import { assert as sinonAssert, createSandbox } from 'sinon';

import * as userAuthenticationController from './user-authentication.controller';
import { config } from '../../../../dependencies';
import local from '../../../../lib/strategies/local';
import proxyPki from '../../../../lib/strategies/proxy-pki';
import { getResponseSpy } from '../../../../spec/helpers';
import {
	BadRequestError,
	ForbiddenError,
	UnauthorizedError
} from '../../../common/errors';
import {
	CacheEntry,
	ICacheEntry
} from '../../access-checker/cache/cache-entry.model';
import { IUser, User } from '../user.model';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const emptyFn = () => {};

/**
 * Helpers
 */
function clearDatabase() {
	return Promise.all([
		User.deleteMany({}).exec(),
		CacheEntry.deleteMany({}).exec()
	]);
}

function userSpec(key): Partial<IUser> {
	return {
		name: `${key} Name`,
		email: `${key}@mail.com`,
		username: `${key}_username`,
		organization: `${key} Organization`
	};
}

function localUserSpec(key) {
	const spec = userSpec(key);
	spec.provider = 'local';
	spec.password = 'password';
	return spec;
}

function proxyPkiUserSpec(key) {
	const spec = userSpec(key);
	spec.provider = 'proxy-pki';
	spec.providerData = {
		dn: key,
		dnLower: key.toLowerCase()
	};
	return spec;
}

function cacheSpec(key): Partial<ICacheEntry> {
	return {
		key: key.toLowerCase(),
		value: {
			name: `${key} Name`,
			organization: `${key} Organization`,
			email: `${key}@mail.com`,
			username: `${key}_username`
		}
	};
}

/**
 * Unit tests
 */
describe('User Auth Controller:', () => {
	let res;
	let sandbox;

	before(() => {
		return clearDatabase();
	});

	after(() => {
		return clearDatabase();
	});

	beforeEach(() => {
		sandbox = createSandbox();
		res = getResponseSpy();
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('signout', () => {
		it('should successfully redirect after logout', () => {
			const req = {
				logout: (cb: () => void) => {
					if (cb) {
						return cb();
					}
				}
			};

			userAuthenticationController.signout(req, res);

			sinonAssert.calledWith(res.redirect, '/');
		});
	});

	describe("'local' Strategy", () => {
		const spec = { user: localUserSpec('user1') };
		let user;

		beforeEach(async () => {
			await clearDatabase();
			user = await new User(spec.user).save();

			//setup to use local passport
			const configGetStub = sandbox.stub(config, 'get');
			configGetStub.withArgs('auth.strategy').returns('local');
			configGetStub.callThrough();

			passport.use(local);
		});

		afterEach(() => {
			return clearDatabase();
		});

		describe('login', () => {
			it('should succeed with correct credentials', async () => {
				const req: Record<string, unknown> = {};
				req.body = {
					username: spec.user.username,
					password: spec.user.password
				};
				req.headers = {};
				req.logIn = (u, cb) => {
					return cb && cb();
				};

				await userAuthenticationController.signin(req, res, emptyFn);
				sinonAssert.calledWith(res.status, 200);
				sinonAssert.calledOnce(res.json);

				const [result] = res.json.getCall(0).args;
				// Should return the user
				assert(result);
				assert.equal(result.username, user.username);
				assert.equal(result.name, user.name);
				// The user's password should have been removed
				assert.equal(result.password, undefined);
			});

			it('should fail with incorrect password', async () => {
				const req: Record<string, unknown> = {};
				req.body = { username: user.username, password: 'wrong' };
				req.headers = {};
				req.logIn = (u, cb) => {
					return cb && cb();
				};

				await assert.rejects(
					userAuthenticationController.signin(req, res, emptyFn),
					new UnauthorizedError('Incorrect username or password')
				);

				sinonAssert.notCalled(res.status);
				sinonAssert.notCalled(res.json);
			});

			it('should fail with missing password', async () => {
				const req: Record<string, unknown> = {};
				req.body = { username: user.username, password: undefined };
				req.headers = {};
				req.logIn = (_user, cb) => {
					return cb && cb();
				};

				await assert.rejects(
					userAuthenticationController.signin(req, res, emptyFn),
					{ message: 'Missing credentials' }
				);

				sinonAssert.notCalled(res.status);
				sinonAssert.notCalled(res.json);
			});

			it('should fail with missing username', async () => {
				const req: Record<string, unknown> = {};
				req.body = { username: undefined, password: 'asdfasdf' };
				req.headers = {};
				req.login = (_user, cb) => {
					return cb && cb();
				};

				await assert.rejects(
					userAuthenticationController.signin(req, res, emptyFn),
					{ message: 'Missing credentials' }
				);

				sinonAssert.notCalled(res.status);
				sinonAssert.notCalled(res.json);
			});

			it('should fail with unknown user', async () => {
				const req: Record<string, unknown> = {};
				req.body = { username: 'totally doesnt exist', password: 'asdfasdf' };
				req.headers = {};
				req.logIn = (_user, cb) => {
					return cb && cb();
				};

				await assert.rejects(
					userAuthenticationController.signin(req, res, emptyFn),
					new UnauthorizedError('Incorrect username or password')
				);

				sinonAssert.notCalled(res.status);
				sinonAssert.notCalled(res.json);
			});
		}); // describe - login
	});

	describe('Proxy PKI Strategy', () => {
		// Specs for tests
		const spec = {
			cache: {} as Record<string, Partial<ICacheEntry>>,
			user: {} as Record<string, Partial<IUser>>
		};

		// Synced User/Cache Entry
		spec.cache.synced = cacheSpec('synced');
		spec.cache.synced.value.roles = ['role1', 'role2'];
		spec.cache.synced.value.groups = ['group1', 'group2'];
		spec.user.synced = proxyPkiUserSpec('synced');
		spec.user.synced.externalRoles = ['role1', 'role2'];
		spec.user.synced.externalGroups = ['group1', 'group2'];

		// Different user metadata in cache
		spec.cache.oldMd = cacheSpec('oldMd');
		spec.user.oldMd = proxyPkiUserSpec('oldMd');
		spec.cache.oldMd.value.name = 'New Name';
		spec.cache.oldMd.value.organization = 'New Organization';
		spec.cache.oldMd.value.email = 'new.email@mail.com';

		// Different roles in cache
		spec.cache.differentRolesAndGroups = cacheSpec('differentRoles');
		spec.cache.differentRolesAndGroups.value.roles = ['role1', 'role2'];
		spec.cache.differentRolesAndGroups.value.groups = ['group1', 'group2'];
		spec.user.differentRolesAndGroups = proxyPkiUserSpec('differentRoles');
		spec.user.differentRolesAndGroups.externalRoles = ['role3', 'role4'];
		spec.user.differentRolesAndGroups.externalGroups = ['group3', 'group4'];

		// Missing from cache, no bypass
		spec.user.missingUser = proxyPkiUserSpec('missingUser');
		spec.user.missingUser.externalRoles = ['role1', 'role2'];
		spec.user.missingUser.externalGroups = ['group1', 'group2'];

		// Expired in cache, no bypass
		spec.user.expiredUser = proxyPkiUserSpec('expiredUser');
		spec.cache.expiredUser = cacheSpec('expiredUser');
		spec.cache.expiredUser.ts = DateTime.now().minus({ days: 2 }).toJSDate();
		spec.user.expiredUser.externalRoles = ['role1', 'role2'];
		spec.user.expiredUser.externalGroups = ['group1', 'group2'];

		// Missing from cache, with bypass
		spec.user.missingUserBypassed = proxyPkiUserSpec('missingUserBypassed');
		spec.user.missingUserBypassed.bypassAccessCheck = true;
		spec.user.missingUserBypassed.externalRoles = ['role1', 'role2'];
		spec.user.missingUserBypassed.externalGroups = ['group1', 'group2'];

		// Missing from cache, in access checker, with bypass with local changes
		spec.user.userBypassed = proxyPkiUserSpec('userBypassed');
		spec.user.userBypassed.bypassAccessCheck = true;
		spec.user.userBypassed.name = 'My New Name';
		spec.user.userBypassed.organization = 'My New Org';

		// Only in cache
		spec.cache.cacheOnly = cacheSpec('cacheOnly');
		spec.cache.cacheOnly.value.roles = ['role1', 'role2', 'role3'];
		spec.cache.cacheOnly.value.groups = ['group1', 'group2', 'group3'];

		spec.user.userCanProxy = proxyPkiUserSpec('proxyableUser');
		spec.user.userCanProxy.canProxy = true;
		spec.user.userCanProxy.name = 'Trusted Server';
		spec.user.userCanProxy.organization = 'Trusted Organization';

		const cache = {};
		const user = {};

		beforeEach(async () => {
			await clearDatabase();
			let defers = [];
			defers = defers.concat(
				_.keys(spec.cache).map(async (k) => {
					cache[k] = await new CacheEntry(spec.cache[k]).save();
				})
			);
			defers = defers.concat(
				_.keys(spec.user).map(async (k_1) => {
					user[k_1] = await new User(spec.user[k_1]).save();
				})
			);
			await Promise.all(defers);

			const configGetStub = sandbox.stub(config, 'get');
			configGetStub.withArgs('auth.strategy').returns('proxy-pki');
			configGetStub
				.withArgs('auth.accessChecker.provider.file')
				.returns('src/app/core/access-checker/providers/example.provider');
			configGetStub.withArgs('auth.accessChecker.provider.config').returns({
				userbypassed: {
					name: 'Invalid Name',
					organization: 'Invalid Org',
					email: 'invalid@invalid.org',
					username: 'invalid'
				}
			});
			configGetStub.callThrough();

			// All of the data is loaded, so initialize proxy-pki
			passport.use(proxyPki);
		});

		afterEach(() => {
			return clearDatabase();
		});

		/**
		 * Test basic login where access checker isn't really involved.
		 * Granting access and denying access based on known/unknown dn
		 */
		describe('basic login', () => {
			const req: Record<string, unknown> = {};
			req.logIn = (_user, cb) => {
				return cb && cb();
			};

			it('should work when user is synced with access checker', async () => {
				req.headers = {
					[config.get<string>('proxyPkiPrimaryUserHeader')]:
						spec.user.synced.providerData.dn
				};

				await userAuthenticationController.signin(req, res, emptyFn);

				sinonAssert.calledWith(res.status, 200);
				sinonAssert.calledOnce(res.json);

				const [result] = res.json.getCall(0).args;

				assert(result);
				assert.equal(result.name, spec.user.synced.name);
				assert.equal(result.organization, spec.user.synced.organization);
				assert.equal(result.email, spec.user.synced.email);
				assert.equal(result.username, spec.user.synced.username);

				assert(
					Array.isArray(result.externalRoles),
					'expect externalRoles should be an Array'
				);
				assert.deepStrictEqual(
					result.externalRoles,
					spec.user.synced.externalRoles
				);
			});

			// No DN header
			it('should fail when there is no dn', async () => {
				req.headers = {};

				await assert.rejects(
					userAuthenticationController.signin(req, res, emptyFn),
					new BadRequestError('Missing certificate')
				);

				sinonAssert.notCalled(res.status);
				sinonAssert.notCalled(res.json);
			});

			// Unknown DN header
			it('should fail when the dn is unknown and auto create is disabled', async () => {
				/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
				const configGetStub = config.get as any;
				configGetStub.withArgs('auth.autoCreateAccounts').returns(false);

				req.headers = {
					[config.get<string>('proxyPkiPrimaryUserHeader')]: 'unknown'
				};

				await assert.rejects(
					userAuthenticationController.signin(req, {}, emptyFn),
					new UnauthorizedError(
						'Could not authenticate request, please verify your credentials.'
					)
				);
			});
		});

		/**
		 * Test situations where access checking is more involved because the cache
		 * is not in sync with the user
		 */
		describe('syncing with access checker', () => {
			const req: Record<string, unknown> = {};
			req.logIn = (_user, cb) => {
				return cb && cb();
			};

			it('should update the user info from access checker on login', async () => {
				req.headers = {
					[config.get<string>('proxyPkiPrimaryUserHeader')]:
						spec.user.oldMd.providerData.dn
				};

				await userAuthenticationController.signin(req, res, emptyFn);

				sinonAssert.calledWith(res.status, 200);
				sinonAssert.calledOnce(res.json);
				const [result] = res.json.getCall(0).args;

				assert(result);
				assert.equal(result.name, spec.cache.oldMd.value.name);
				assert.equal(result.organization, spec.cache.oldMd.value.organization);
				assert.equal(result.email, spec.cache.oldMd.value.email);
				assert.equal(result.username, spec.cache.oldMd.value.username);
			});

			it('should sync roles and groups from access checker on login', async () => {
				req.headers = {
					[config.get<string>('proxyPkiPrimaryUserHeader')]:
						spec.user.differentRolesAndGroups.providerData.dn
				};

				await userAuthenticationController.signin(req, res, emptyFn);

				sinonAssert.calledWith(res.status, 200);
				sinonAssert.calledOnce(res.json);

				const [result] = res.json.getCall(0).args;
				assert(result);
				assert(
					Array.isArray(result.externalRoles),
					'expect externalRoles should be an Array'
				);
				assert.deepStrictEqual(
					result.externalRoles,
					spec.cache.differentRolesAndGroups.value.roles
				);

				assert(
					Array.isArray(result.externalGroups),
					'expect externalGroups should be an Array'
				);
				assert.deepStrictEqual(
					result.externalGroups,
					spec.cache.differentRolesAndGroups.value.groups
				);
			});
		});

		describe('missing or expired cache entries with no bypass', () => {
			const req: Record<string, unknown> = {};
			req.logIn = (_user, cb) => {
				return cb && cb();
			};

			it('should have external roles and groups removed on login when missing from cache', async () => {
				req.headers = {
					[config.get<string>('proxyPkiPrimaryUserHeader')]:
						spec.user.missingUser.providerData.dn
				};

				await userAuthenticationController.signin(req, res, emptyFn);

				sinonAssert.calledWith(res.status, 200);
				sinonAssert.calledOnce(res.json);

				const [result] = res.json.getCall(0).args;
				assert(result);
				assert.equal(result.name, spec.user.missingUser.name);
				assert.equal(result.organization, spec.user.missingUser.organization);
				assert.equal(result.email, spec.user.missingUser.email);
				assert.equal(result.username, spec.user.missingUser.username);

				assert(
					Array.isArray(result.externalRoles),
					'expect externalRoles should be an Array'
				);
				assert.equal(result.externalRoles.length, 0);

				assert(
					Array.isArray(result.externalGroups),
					'expect externalGroups should be an Array'
				);
				assert.equal(result.externalGroups.length, 0);
			});

			it('should have external roles and groups removed on login when cache expired', async () => {
				req.headers = {
					[config.get<string>('proxyPkiPrimaryUserHeader')]:
						spec.user.expiredUser.providerData.dn
				};

				await userAuthenticationController.signin(req, res, emptyFn);

				sinonAssert.calledWith(res.status, 200);
				sinonAssert.calledOnce(res.json);

				const [result] = res.json.getCall(0).args;
				assert(result);
				assert.equal(result.name, spec.user.expiredUser.name);
				assert.equal(result.organization, spec.user.expiredUser.organization);
				assert.equal(result.email, spec.user.expiredUser.email);
				assert.equal(result.username, spec.user.expiredUser.username);

				assert(
					Array.isArray(result.externalRoles),
					'expect externalRoles should be an Array'
				);
				assert.equal(result.externalRoles.length, 0);

				assert(
					Array.isArray(result.externalGroups),
					'expect externalGroups should be an Array'
				);
				assert.equal(result.externalGroups.length, 0);
			});
		});

		describe('missing cache entries with bypass access checker enabled', () => {
			const req: Record<string, unknown> = {};
			req.logIn = (_user, cb) => {
				return cb && cb();
			};

			it('should preserve user info, roles and groups on login', async () => {
				req.headers = {
					[config.get<string>('proxyPkiPrimaryUserHeader')]:
						spec.user.missingUserBypassed.providerData.dn
				};

				await userAuthenticationController.signin(req, res, emptyFn);

				sinonAssert.calledWith(res.status, 200);
				sinonAssert.calledOnce(res.json);

				const [result] = res.json.getCall(0).args;

				assert(result);
				assert.equal(result.name, spec.user.missingUserBypassed.name);
				assert.equal(
					result.organization,
					spec.user.missingUserBypassed.organization
				);
				assert.equal(result.email, spec.user.missingUserBypassed.email);
				assert.equal(result.username, spec.user.missingUserBypassed.username);

				assert(
					Array.isArray(result.externalRoles),
					'expect externalRoles should be an Array'
				);
				assert.deepStrictEqual(
					result.externalRoles,
					spec.user.missingUserBypassed.externalRoles
				);

				assert(
					Array.isArray(result.externalGroups),
					'expect externalGroups should be an Array'
				);
				assert.deepStrictEqual(
					result.externalGroups,
					spec.user.missingUserBypassed.externalGroups
				);
			});
		});

		describe('in cache, access checker enabled, but with fields modified locally', () => {
			const req: Record<string, unknown> = {};
			req.logIn = (_user, cb) => {
				return cb && cb();
			};

			it('should preserve user info, roles and groups on login', async () => {
				req.headers = {
					[config.get<string>('proxyPkiPrimaryUserHeader')]:
						spec.user.userBypassed.providerData.dn
				};

				await userAuthenticationController.signin(req, res, emptyFn);

				sinonAssert.calledWith(res.status, 200);
				sinonAssert.calledOnce(res.json);

				const [result] = res.json.getCall(0).args;
				assert(result);
				assert.equal(result.name, spec.user.userBypassed.name);
				assert.equal(result.organization, spec.user.userBypassed.organization);
				assert.equal(result.email, spec.user.userBypassed.email);
				assert.equal(result.username, spec.user.userBypassed.username);

				assert(
					Array.isArray(result.externalRoles),
					'expect externalRoles should be an Array'
				);
				assert.equal(result.externalRoles.length, 0);

				assert(
					Array.isArray(result.externalGroups),
					'expect externalGroups should be an Array'
				);
				assert.equal(result.externalGroups.length, 0);
			});
		});

		describe('auto create accounts', () => {
			const req: Record<string, unknown> = {};
			req.logIn = (_user, cb) => {
				return cb && cb();
			};

			it('should create a new account from access checker information', async () => {
				/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
				const configGetStub = config.get as any;
				configGetStub.withArgs('auth.autoCreateAccounts').returns(true);

				req.headers = {
					[config.get<string>('proxyPkiPrimaryUserHeader')]:
						spec.cache.cacheOnly.key
				};

				await userAuthenticationController.signin(req, res, () => {
					sinonAssert.error('should not be called');
				});

				sinonAssert.calledWith(res.status, 200);
				sinonAssert.calledOnce(res.json);

				const [result] = res.json.getCall(0).args;
				assert(result);
				assert.equal(result.name, spec.cache.cacheOnly.value.name);
				assert.equal(
					result.organization,
					spec.cache.cacheOnly.value.organization
				);
				assert.equal(result.email, spec.cache.cacheOnly.value.email);
				assert.equal(result.username, spec.cache.cacheOnly.value.username);

				assert(
					Array.isArray(result.externalRoles),
					'expect externalRoles should be an Array'
				);
				assert.deepStrictEqual(
					result.externalRoles,
					spec.cache.cacheOnly.value.roles
				);

				assert(
					Array.isArray(result.externalGroups),
					'expect externalGroups should be an Array'
				);
				assert.deepStrictEqual(
					result.externalGroups,
					spec.cache.cacheOnly.value.groups
				);
			});
		});

		describe('proxy for other users', () => {
			/**
			 * @type {any}
			 */
			let req;

			beforeEach(() => {
				req = {};
				req.logIn = (_user, cb) => {
					return cb && cb();
				};
			});

			it('should fail when not authorized to proxy users', async () => {
				req.headers = {
					[config.get<string>('proxyPkiPrimaryUserHeader')]:
						spec.user.synced.providerData.dn,
					[config.get<string>('proxyPkiProxiedUserHeader')]:
						spec.user.userBypassed.providerData.dn
				};

				await assert.rejects(
					userAuthenticationController.signin(req, res, emptyFn),
					new ForbiddenError(
						'Not approved to proxy users. Please verify your credentials.'
					)
				);

				sinonAssert.notCalled(res.status);
				sinonAssert.notCalled(res.json);
			});

			it('should succeed when authorized to proxy users', async () => {
				req.headers = {
					[config.get<string>('proxyPkiPrimaryUserHeader')]:
						spec.user.userCanProxy.providerData.dn,
					[config.get<string>('proxyPkiProxiedUserHeader')]:
						spec.user.userBypassed.providerData.dn
				};

				await userAuthenticationController.signin(req, res, emptyFn);

				sinonAssert.calledWith(res.status, 200);
				sinonAssert.calledOnce(res.json);

				// Verify that the user returned is the proxied user (not the primary user)
				const [result] = res.json.getCall(0).args;
				assert(result);
				assert.equal(result.name, spec.user.userBypassed.name);
				assert.equal(result.organization, spec.user.userBypassed.organization);
				assert.equal(result.email, spec.user.userBypassed.email);
				assert.equal(result.username, spec.user.userBypassed.username);

				assert(
					Array.isArray(result.externalRoles),
					'expect externalRoles should be an Array'
				);
				assert.equal(result.externalRoles.length, 0);

				assert(
					Array.isArray(result.externalGroups),
					'expect externalGroups should be an Array'
				);
				assert.equal(result.externalGroups.length, 0);
			});
		});
	});
});
