'use strict';

const _ = require('lodash'),
	should = require('should'),
	deps = require('../../../../dependencies'),
	config = deps.config,
	dbs = deps.dbs,
	User = dbs.admin.model('User'),
	CacheEntry = dbs.admin.model('CacheEntry'),
	local = require('../../../../lib/strategies/local'),
	proxyPki = require('../../../../lib/strategies/proxy-pki'),
	userAuthenticationController = require('./user-authentication.controller');

/**
 * Helpers
 */
function clearDatabase() {
	return Promise.all([
		User.deleteMany({}).exec(),
		CacheEntry.deleteMany({}).exec()
	]);
}

function userSpec(key) {
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

function cacheSpec(key) {
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
	before(() => {
		return clearDatabase();
	});

	after(() => {
		return clearDatabase();
	});

	describe("'local' Strategy", () => {
		const spec = { user: localUserSpec('user1') };
		let user;

		before(() => {
			return clearDatabase().then(() => {
				// Create the user
				return new User(spec.user).save().then((result) => {
					user = result;

					//setup to use local passport
					config.auth.strategy = 'local';
					local();
				});
			});
		});

		after(() => {
			return clearDatabase();
		});

		describe('login', () => {
			it('should succeed with correct credentials', (done) => {
				const req = {};
				req.body = {
					username: spec.user.username,
					password: spec.user.password
				};
				req.headers = {};
				req.login = (u, cb) => {
					return cb && cb();
				};

				const res = {};
				res.status = (status) => {
					should(status).equal(200);

					return {
						json: (result) => {
							// Should return the user
							should.exist(result);
							should(result.username).equal(user.username);
							should(result.name).equal(user.name);

							// The user's password should be removed
							should.not.exist(result.password);

							done();
						}
					};
				};

				userAuthenticationController.signin(req, res, () => {});
			});

			it('should fail with incorrect password', (done) => {
				const req = {};
				req.body = { username: user.username, password: 'wrong' };
				req.headers = {};
				req.login = (u, cb) => {
					return cb && cb();
				};

				const res = {};
				res.status = (status) => {
					should(status).equal(401);

					return {
						json: (info) => {
							should.exist(info);
							should(info.type).equal('invalid-credentials');

							done();
						}
					};
				};

				userAuthenticationController.signin(req, res, () => {});
			});

			it('should fail with missing password', (done) => {
				const req = {};
				req.body = { username: user.username, password: undefined };
				req.headers = {};
				req.login = (_user, cb) => {
					return cb && cb();
				};

				const res = {
					status: (status) => {
						should(status).equal(400);

						return {
							json: (info) => {
								should.exist(info);
								should(info.type).equal('missing-credentials');

								done();
							}
						};
					}
				};

				userAuthenticationController.signin(req, res, () => {});
			});

			it('should fail with missing username', (done) => {
				const req = {};
				req.body = { username: undefined, password: 'asdfasdf' };
				req.headers = {};
				req.login = (_user, cb) => {
					return cb && cb();
				};

				const res = {
					status: (status) => {
						should(status).equal(400);

						return {
							json: (info) => {
								should.exist(info);
								should(info.type).equal('missing-credentials');

								done();
							}
						};
					}
				};

				userAuthenticationController.signin(req, res, () => {});
			});

			it('should fail with unknown user', (done) => {
				const req = {};
				req.body = { username: 'totally doesnt exist', password: 'asdfasdf' };
				req.headers = {};
				req.login = (_user, cb) => {
					return cb && cb();
				};

				const res = {
					status: (status) => {
						should(status).equal(401);

						return {
							json: (info) => {
								should.exist(info);
								should(info.type).equal('invalid-credentials');

								done();
							}
						};
					}
				};

				userAuthenticationController.signin(req, res, () => {});
			});
		}); // describe - login
	});

	describe('Proxy PKI Strategy', () => {
		// Specs for tests
		const spec = { cache: {}, user: {} };

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
		spec.cache.oldMd.value.email = 'New Email';

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
		spec.cache.expiredUser.ts = Date.now() - 1000 * 60 * 60 * 48;
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

		before(() => {
			return clearDatabase().then(() => {
				let defers = [];

				defers = defers.concat(
					_.keys(spec.cache).map((k) => {
						return new CacheEntry(spec.cache[k]).save().then((e) => {
							cache[k] = e;
						});
					})
				);

				defers = defers.concat(
					_.keys(spec.user).map((k) => {
						return new User(spec.user[k]).save().then((e) => {
							user[k] = e;
						});
					})
				);

				return Promise.all(defers).then(() => {
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
							file:
								'src/app/core/access-checker/providers/example-provider.service.js',
							config: accessCheckerConfig
						}
					};
					proxyPki();
				});
			});
		});

		after(() => {
			return clearDatabase();
		});

		/**
		 * Test basic login where access checker isn't really involved.
		 * Granting access and denying access based on known/unknown dn
		 */
		describe('basic login', () => {
			const req = {};
			req.login = (_user, cb) => {
				return cb && cb();
			};

			it('should work when user is synced with access checker', (done) => {
				req.headers = {
					[config.proxyPkiPrimaryUserHeader]: spec.user.synced.providerData.dn
				};
				const res = {
					status: (status) => {
						should(status).equal(200);
						return {
							json: (info) => {
								should.exist(info);
								should(info.name).equal(spec.user.synced.name);
								should(info.organization).equal(spec.user.synced.organization);
								should(info.email).equal(spec.user.synced.email);
								should(info.username).equal(spec.user.synced.username);

								should(info.externalRoles).be.an.Array();
								should(info.externalRoles).have.length(
									spec.user.synced.externalRoles.length
								);
								should(info.externalRoles).containDeep(
									spec.user.synced.externalRoles
								);

								done();
							}
						};
					}
				};

				userAuthenticationController.signin(req, res, () => {});
			});

			// No DN header
			it('should fail when there is no dn', (done) => {
				req.headers = {};
				const res = {
					status: (status) => {
						return {
							json: (info) => {
								should(info.type).equal('missing-credentials');
								should(status).equal(400);

								done();
							}
						};
					}
				};

				userAuthenticationController.signin(req, res, () => {});
			});

			// Unknown DN header
			it('should fail when the dn is unknown and auto create is disabled', (done) => {
				config.auth.autoCreateAccounts = false;
				req.headers = { [config.proxyPkiPrimaryUserHeader]: 'unknown' };
				const res = {
					status: (status) => {
						return {
							json: (info) => {
								should(info.type).equal('invalid-credentials');
								should(status).equal(401);

								config.auth.autoCreateAccounts = true;

								done();
							}
						};
					}
				};

				userAuthenticationController.signin(req, res, () => {});
			});
		});

		/**
		 * Test situations where access checking is more involved because the cache
		 * is not in sync with the user
		 */
		describe('syncing with access checker', () => {
			const req = {};
			req.login = (_user, cb) => {
				return cb && cb();
			};

			it('should update the user info from access checker on login', (done) => {
				req.headers = {
					[config.proxyPkiPrimaryUserHeader]: spec.user.oldMd.providerData.dn
				};
				const res = {
					status: (status) => {
						should(status).equal(200);
						return {
							json: (info) => {
								should.exist(info);
								should(info.name).equal(spec.cache.oldMd.value.name);
								should(info.organization).equal(
									spec.cache.oldMd.value.organization
								);
								should(info.email).equal(spec.cache.oldMd.value.email);
								should(info.username).equal(spec.cache.oldMd.value.username);

								done();
							}
						};
					}
				};

				userAuthenticationController.signin(req, res, () => {});
			});

			it('should sync roles and groups from access checker on login', (done) => {
				req.headers = {
					[config.proxyPkiPrimaryUserHeader]:
						spec.user.differentRolesAndGroups.providerData.dn
				};
				const res = {
					status: (status) => {
						should(status).equal(200);
						return {
							json: (info) => {
								should.exist(info);

								should(info.externalRoles).be.an.Array();
								should(info.externalRoles).have.length(
									spec.cache.differentRolesAndGroups.value.roles.length
								);
								should(info.externalRoles).containDeep(
									spec.cache.differentRolesAndGroups.value.roles
								);

								should(info.externalGroups).be.an.Array();
								should(info.externalGroups).have.length(
									spec.cache.differentRolesAndGroups.value.groups.length
								);
								should(info.externalGroups).containDeep(
									spec.cache.differentRolesAndGroups.value.groups
								);

								done();
							}
						};
					}
				};

				userAuthenticationController.signin(req, res, () => {});
			});
		});

		describe('missing or expired cache entries with no bypass', () => {
			const req = {};
			req.login = (_user, cb) => {
				return cb && cb();
			};

			it('should have external roles and groups removed on login when missing from cache', (done) => {
				req.headers = {
					[config.proxyPkiPrimaryUserHeader]:
						spec.user.missingUser.providerData.dn
				};
				const res = {
					status: (status) => {
						should(status).equal(200);
						return {
							json: (info) => {
								should.exist(info);
								should(info.name).equal(spec.user.missingUser.name);
								should(info.organization).equal(
									spec.user.missingUser.organization
								);
								should(info.email).equal(spec.user.missingUser.email);
								should(info.username).equal(spec.user.missingUser.username);

								should(info.externalRoles).be.an.Array();
								info.externalRoles.should.have.length(0);

								should(info.externalGroups).be.an.Array();
								info.externalGroups.should.have.length(0);

								done();
							}
						};
					}
				};

				userAuthenticationController.signin(req, res, () => {});
			});

			it('should have external roles and groups removed on login when cache expired', (done) => {
				req.headers = {
					[config.proxyPkiPrimaryUserHeader]:
						spec.user.expiredUser.providerData.dn
				};
				const res = {
					status: (status) => {
						should(status).equal(200);
						return {
							json: (info) => {
								should.exist(info);
								should(info.name).equal(spec.user.expiredUser.name);
								should(info.organization).equal(
									spec.user.expiredUser.organization
								);
								should(info.email).equal(spec.user.expiredUser.email);
								should(info.username).equal(spec.user.expiredUser.username);

								should(info.externalRoles).be.an.Array();
								info.externalRoles.should.have.length(0);

								should(info.externalGroups).be.an.Array();
								info.externalGroups.should.have.length(0);

								done();
							}
						};
					}
				};

				userAuthenticationController.signin(req, res, () => {});
			});
		});

		describe('missing cache entries with bypass access checker enabled', () => {
			const req = {};
			req.login = (_user, cb) => {
				return cb && cb();
			};

			it('should preserve user info, roles and groups on login', (done) => {
				req.headers = {
					[config.proxyPkiPrimaryUserHeader]:
						spec.user.missingUserBypassed.providerData.dn
				};
				const res = {
					status: (status) => {
						should(status).equal(200);
						return {
							json: (info) => {
								should.exist(info);
								should(info.name).equal(spec.user.missingUserBypassed.name);
								should(info.organization).equal(
									spec.user.missingUserBypassed.organization
								);
								should(info.email).equal(spec.user.missingUserBypassed.email);
								should(info.username).equal(
									spec.user.missingUserBypassed.username
								);

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

								done();
							}
						};
					}
				};

				userAuthenticationController.signin(req, res, () => {});
			});
		});

		describe('in cache, access checker enabled, but with fields modified locally', () => {
			const req = {};
			req.login = (_user, cb) => {
				return cb && cb();
			};

			it('should preserve user info, roles and groups on login', (done) => {
				req.headers = {
					[config.proxyPkiPrimaryUserHeader]:
						spec.user.userBypassed.providerData.dn
				};
				const res = {
					status: (status) => {
						should(status).equal(200);
						return {
							json: (info) => {
								should.exist(info);
								should(info.name).equal(spec.user.userBypassed.name);
								should(info.organization).equal(
									spec.user.userBypassed.organization
								);
								should(info.email).equal(spec.user.userBypassed.email);
								should(info.username).equal(spec.user.userBypassed.username);

								should(info.externalRoles).be.an.Array();
								should(info.externalRoles).have.length(0);

								should(info.externalGroups).be.an.Array();
								should(info.externalGroups).have.length(0);

								done();
							}
						};
					}
				};

				userAuthenticationController.signin(req, res, () => {});
			});
		});

		describe('auto create accounts', () => {
			const req = {};
			req.login = (_user, cb) => {
				return cb && cb();
			};

			it('should create a new account from access checker information', (done) => {
				req.headers = {
					[config.proxyPkiPrimaryUserHeader]: spec.cache.cacheOnly.key
				};
				const res = {
					status: (status) => {
						should(status).equal(200);
						return {
							json: (info) => {
								should.exist(info);
								should(info.name).equal(spec.cache.cacheOnly.value.name);
								should(info.organization).equal(
									spec.cache.cacheOnly.value.organization
								);
								should(info.email).equal(spec.cache.cacheOnly.value.email);
								should(info.username).equal(
									spec.cache.cacheOnly.value.username
								);

								should(info.externalRoles).be.an.Array();
								should(info.externalRoles).have.length(
									spec.cache.cacheOnly.value.roles.length
								);
								should(info.externalRoles).containDeep(
									spec.cache.cacheOnly.value.roles
								);

								should(info.externalGroups).be.an.Array();
								should(info.externalGroups).have.length(
									spec.cache.cacheOnly.value.groups.length
								);
								should(info.externalGroups).containDeep(
									spec.cache.cacheOnly.value.groups
								);

								done();
							}
						};
					}
				};

				userAuthenticationController.signin(req, res, () => {});
			});
		});

		describe('proxy for other users', () => {
			const req = {};
			req.login = (_user, cb) => {
				return cb && cb();
			};

			it('should failed when not authorized to proxy users', (done) => {
				req.headers = {
					[config.proxyPkiPrimaryUserHeader]: spec.user.synced.providerData.dn,
					[config.proxyPkiProxiedUserHeader]:
						spec.user.userBypassed.providerData.dn
				};
				const res = {
					status: (status) => {
						should(status).equal(403);
						return {
							json: (info) => {
								should.exist(info);
								should(info).eql({
									status: 403,
									message:
										'Not approved to proxy users. Please verify your credentials.',
									type: 'authentication-error'
								});

								done();
							}
						};
					}
				};

				userAuthenticationController.signin(req, res, () => {});
			});

			it('should succeed when authorized to proxy users', (done) => {
				req.headers = {
					[config.proxyPkiPrimaryUserHeader]:
						spec.user.userCanProxy.providerData.dn,
					[config.proxyPkiProxiedUserHeader]:
						spec.user.userBypassed.providerData.dn
				};
				const res = {
					status: (status) => {
						should(status).equal(200);
						return {
							json: (info) => {
								// Verify that the user returned is the proxied user (not the primary user)
								should.exist(info);
								should(info.name).equal(spec.user.userBypassed.name);
								should(info.organization).equal(
									spec.user.userBypassed.organization
								);
								should(info.email).equal(spec.user.userBypassed.email);
								should(info.username).equal(spec.user.userBypassed.username);

								should(info.externalRoles).be.an.Array();
								should(info.externalRoles).have.length(0);

								should(info.externalGroups).be.an.Array();
								should(info.externalGroups).have.length(0);

								done();
							}
						};
					}
				};

				userAuthenticationController.signin(req, res, () => {});
			});
		});
	});
});
