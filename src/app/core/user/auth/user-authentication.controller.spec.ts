import _ from 'lodash';
import { DateTime } from 'luxon';
import passport from 'passport';
import should from 'should';
import { assert } from 'sinon';

import * as userAuthenticationController from './user-authentication.controller';
import { config } from '../../../../dependencies';
import local from '../../../../lib/strategies/local';
import proxyPki from '../../../../lib/strategies/proxy-pki';
import { getResponseSpy } from '../../../../spec/helpers';
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

	before(() => {
		return clearDatabase();
	});

	after(() => {
		return clearDatabase();
	});

	beforeEach(() => {
		res = getResponseSpy();
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

			assert.calledWith(res.redirect, '/');
		});
	});

	describe("'local' Strategy", () => {
		const spec = { user: localUserSpec('user1') };
		let user;

		before(async () => {
			await clearDatabase();
			user = await new User(spec.user).save();

			//setup to use local passport
			config.auth.strategy = 'local';
			passport.use(local);
		});

		after(() => {
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
				assert.calledWith(res.status, 200);
				assert.calledOnce(res.json);

				const [result] = res.json.getCall(0).args;
				// Should return the user
				should.exist(result);
				should(result.username).equal(user.username);
				should(result.name).equal(user.name);
				// The user's password should have been removed
				should.not.exist(result.password);
			});

			it('should fail with incorrect password', async () => {
				const req: Record<string, unknown> = {};
				req.body = { username: user.username, password: 'wrong' };
				req.headers = {};
				req.logIn = (u, cb) => {
					return cb && cb();
				};

				let err;
				try {
					await userAuthenticationController.signin(req, res, emptyFn);
				} catch (e) {
					err = e;
				}

				assert.notCalled(res.status);
				assert.notCalled(res.json);

				should.exist(err);
				should(err.type).equal('invalid-credentials');
			});

			it('should fail with missing password', async () => {
				const req: Record<string, unknown> = {};
				req.body = { username: user.username, password: undefined };
				req.headers = {};
				req.logIn = (_user, cb) => {
					return cb && cb();
				};

				let err;
				try {
					await userAuthenticationController.signin(req, res, emptyFn);
				} catch (e) {
					err = e;
				}

				assert.notCalled(res.status);
				assert.notCalled(res.json);

				should.exist(err);
				should(err.type).equal('missing-credentials');
			});

			it('should fail with missing username', async () => {
				const req: Record<string, unknown> = {};
				req.body = { username: undefined, password: 'asdfasdf' };
				req.headers = {};
				req.login = (_user, cb) => {
					return cb && cb();
				};

				let err;
				try {
					await userAuthenticationController.signin(req, res, emptyFn);
				} catch (e) {
					err = e;
				}

				assert.notCalled(res.status);
				assert.notCalled(res.json);

				should.exist(err);
				should(err.type).equal('missing-credentials');
			});

			it('should fail with unknown user', async () => {
				const req: Record<string, unknown> = {};
				req.body = { username: 'totally doesnt exist', password: 'asdfasdf' };
				req.headers = {};
				req.logIn = (_user, cb) => {
					return cb && cb();
				};

				let err;
				try {
					await userAuthenticationController.signin(req, res, emptyFn);
				} catch (e) {
					err = e;
				}

				assert.notCalled(res.status);
				assert.notCalled(res.json);

				should.exist(err);
				should(err.type).equal('invalid-credentials');
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

		before(async () => {
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

			const accessCheckerConfig = {
				userbypassed: {
					name: 'Invalid Name',
					organization: 'Invalid Org',
					email: 'invalid@invalid.org',
					username: 'invalid'
				}
			};
			// All of the data is loaded, so initialize proxy-pki
			config.auth.strategy = 'proxy-pki';
			config.auth.accessChecker = {
				provider: {
					file: 'src/app/core/access-checker/providers/example.provider',
					config: accessCheckerConfig
				}
			};
			passport.use(proxyPki);
		});

		after(() => {
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
					[config.proxyPkiPrimaryUserHeader]: spec.user.synced.providerData.dn
				};

				await userAuthenticationController.signin(req, res, emptyFn);

				assert.calledWith(res.status, 200);
				assert.calledOnce(res.json);

				const [result] = res.json.getCall(0).args;
				should.exist(result);
				should(result.name).equal(spec.user.synced.name);
				should(result.organization).equal(spec.user.synced.organization);
				should(result.email).equal(spec.user.synced.email);
				should(result.username).equal(spec.user.synced.username);

				should(result.externalRoles).be.an.Array();
				should(result.externalRoles).have.length(
					spec.user.synced.externalRoles.length
				);
				should(result.externalRoles).containDeep(
					spec.user.synced.externalRoles
				);
			});

			// No DN header
			it('should fail when there is no dn', async () => {
				req.headers = {};

				let err;
				try {
					await userAuthenticationController.signin(req, res, emptyFn);
				} catch (e) {
					err = e;
				}

				assert.notCalled(res.status);
				assert.notCalled(res.json);

				should.exist(err);
				should(err.type).equal('missing-credentials');
			});

			// Unknown DN header
			it('should fail when the dn is unknown and auto create is disabled', async () => {
				config.auth.autoCreateAccounts = false;
				req.headers = { [config.proxyPkiPrimaryUserHeader]: 'unknown' };
				let err;
				try {
					await userAuthenticationController.signin(req, {}, emptyFn);
				} catch (e) {
					err = e;
				}
				should.exist(err);
				should(err.type).equal('invalid-credentials');
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
					[config.proxyPkiPrimaryUserHeader]: spec.user.oldMd.providerData.dn
				};

				await userAuthenticationController.signin(req, res, emptyFn);

				assert.calledWith(res.status, 200);
				assert.calledOnce(res.json);
				const [result] = res.json.getCall(0).args;

				should.exist(result);
				should(result.name).equal(spec.cache.oldMd.value.name);
				should(result.organization).equal(spec.cache.oldMd.value.organization);
				should(result.email).equal(spec.cache.oldMd.value.email);
				should(result.username).equal(spec.cache.oldMd.value.username);
			});

			it('should sync roles and groups from access checker on login', async () => {
				req.headers = {
					[config.proxyPkiPrimaryUserHeader]:
						spec.user.differentRolesAndGroups.providerData.dn
				};

				await userAuthenticationController.signin(req, res, emptyFn);

				assert.calledWith(res.status, 200);
				assert.calledOnce(res.json);

				const [result] = res.json.getCall(0).args;
				should.exist(result);
				should(result.externalRoles).be.an.Array();
				should(result.externalRoles).have.length(
					(spec.cache.differentRolesAndGroups.value.roles as unknown[]).length
				);
				should(result.externalRoles).containDeep(
					spec.cache.differentRolesAndGroups.value.roles
				);

				should(result.externalGroups).be.an.Array();
				should(result.externalGroups).have.length(
					(spec.cache.differentRolesAndGroups.value.groups as unknown[]).length
				);
				should(result.externalGroups).containDeep(
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
					[config.proxyPkiPrimaryUserHeader]:
						spec.user.missingUser.providerData.dn
				};

				await userAuthenticationController.signin(req, res, emptyFn);

				assert.calledWith(res.status, 200);
				assert.calledOnce(res.json);

				const [result] = res.json.getCall(0).args;
				should.exist(result);
				should(result.name).equal(spec.user.missingUser.name);
				should(result.organization).equal(spec.user.missingUser.organization);
				should(result.email).equal(spec.user.missingUser.email);
				should(result.username).equal(spec.user.missingUser.username);

				should(result.externalRoles).be.an.Array();
				result.externalRoles.should.have.length(0);

				should(result.externalGroups).be.an.Array();
				result.externalGroups.should.have.length(0);
			});

			it('should have external roles and groups removed on login when cache expired', async () => {
				req.headers = {
					[config.proxyPkiPrimaryUserHeader]:
						spec.user.expiredUser.providerData.dn
				};

				await userAuthenticationController.signin(req, res, emptyFn);

				assert.calledWith(res.status, 200);
				assert.calledOnce(res.json);

				const [result] = res.json.getCall(0).args;
				should.exist(result);
				should(result.name).equal(spec.user.expiredUser.name);
				should(result.organization).equal(spec.user.expiredUser.organization);
				should(result.email).equal(spec.user.expiredUser.email);
				should(result.username).equal(spec.user.expiredUser.username);

				should(result.externalRoles).be.an.Array();
				result.externalRoles.should.have.length(0);

				should(result.externalGroups).be.an.Array();
				result.externalGroups.should.have.length(0);
			});
		});

		describe('missing cache entries with bypass access checker enabled', () => {
			const req: Record<string, unknown> = {};
			req.logIn = (_user, cb) => {
				return cb && cb();
			};

			it('should preserve user info, roles and groups on login', async () => {
				req.headers = {
					[config.proxyPkiPrimaryUserHeader]:
						spec.user.missingUserBypassed.providerData.dn
				};

				await userAuthenticationController.signin(req, res, emptyFn);

				assert.calledWith(res.status, 200);
				assert.calledOnce(res.json);

				const [info] = res.json.getCall(0).args;

				should.exist(info);
				should(info.name).equal(spec.user.missingUserBypassed.name);
				should(info.organization).equal(
					spec.user.missingUserBypassed.organization
				);
				should(info.email).equal(spec.user.missingUserBypassed.email);
				should(info.username).equal(spec.user.missingUserBypassed.username);

				should(info.externalRoles).be.an.Array();
				should(info.externalRoles).have.length(
					spec.user.missingUserBypassed.externalRoles.length
				);
				should(info.externalRoles).containDeep(
					spec.user.missingUserBypassed.externalRoles
				);

				should(info.externalGroups).be.an.Array();
				should(info.externalGroups).have.length(
					spec.user.missingUserBypassed.externalGroups.length
				);
				should(info.externalGroups).containDeep(
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
					[config.proxyPkiPrimaryUserHeader]:
						spec.user.userBypassed.providerData.dn
				};

				await userAuthenticationController.signin(req, res, emptyFn);

				assert.calledWith(res.status, 200);
				assert.calledOnce(res.json);

				const [result] = res.json.getCall(0).args;
				should.exist(result);
				should(result.name).equal(spec.user.userBypassed.name);
				should(result.organization).equal(spec.user.userBypassed.organization);
				should(result.email).equal(spec.user.userBypassed.email);
				should(result.username).equal(spec.user.userBypassed.username);

				should(result.externalRoles).be.an.Array();
				should(result.externalRoles).have.length(0);

				should(result.externalGroups).be.an.Array();
				should(result.externalGroups).have.length(0);
			});
		});

		describe('auto create accounts', () => {
			const req: Record<string, unknown> = {};
			req.logIn = (_user, cb) => {
				return cb && cb();
			};

			it('should create a new account from access checker information', async () => {
				config.auth.autoCreateAccounts = true;
				req.headers = {
					[config.proxyPkiPrimaryUserHeader]: spec.cache.cacheOnly.key
				};

				await userAuthenticationController.signin(req, res, () => {
					assert.error('should not be called');
				});

				assert.calledWith(res.status, 200);
				assert.calledOnce(res.json);

				const [info] = res.json.getCall(0).args;
				should.exist(info);
				should(info.name).equal(spec.cache.cacheOnly.value.name);
				should(info.organization).equal(
					spec.cache.cacheOnly.value.organization
				);
				should(info.email).equal(spec.cache.cacheOnly.value.email);
				should(info.username).equal(spec.cache.cacheOnly.value.username);

				should(info.externalRoles).be.an.Array();
				should(info.externalRoles).have.length(
					(spec.cache.cacheOnly.value.roles as unknown[]).length
				);
				should(info.externalRoles).containDeep(
					spec.cache.cacheOnly.value.roles
				);

				should(info.externalGroups).be.an.Array();
				should(info.externalGroups).have.length(
					(spec.cache.cacheOnly.value.groups as unknown[]).length
				);
				should(info.externalGroups).containDeep(
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
					[config.proxyPkiPrimaryUserHeader]: spec.user.synced.providerData.dn,
					[config.proxyPkiProxiedUserHeader]:
						spec.user.userBypassed.providerData.dn
				};

				let err;
				try {
					await userAuthenticationController.signin(req, res, emptyFn);
				} catch (e) {
					err = e;
				}

				assert.notCalled(res.status);
				assert.notCalled(res.json);

				should.exist(err);
				should(err).eql({
					status: 403,
					message:
						'Not approved to proxy users. Please verify your credentials.',
					type: 'authentication-error'
				});
			});

			it('should succeed when authorized to proxy users', async () => {
				req.headers = {
					[config.proxyPkiPrimaryUserHeader]:
						spec.user.userCanProxy.providerData.dn,
					[config.proxyPkiProxiedUserHeader]:
						spec.user.userBypassed.providerData.dn
				};

				await userAuthenticationController.signin(req, res, emptyFn);

				assert.calledWith(res.status, 200);
				assert.calledOnce(res.json);

				// Verify that the user returned is the proxied user (not the primary user)
				const [result] = res.json.getCall(0).args;
				should.exist(result);
				should(result.name).equal(spec.user.userBypassed.name);
				should(result.organization).equal(spec.user.userBypassed.organization);
				should(result.email).equal(spec.user.userBypassed.email);
				should(result.username).equal(spec.user.userBypassed.username);

				should(result.externalRoles).be.an.Array();
				should(result.externalRoles).have.length(0);

				should(result.externalGroups).be.an.Array();
				should(result.externalGroups).have.length(0);
			});
		});
	});
});
