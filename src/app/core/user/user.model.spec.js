'use strict';

const should = require('should'),
	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	User = dbs.admin.model('User');

/**
 * Globals
 */
function clearDatabase() {
	return Promise.all([User.deleteMany({}).exec()]);
}

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

/**
 * Unit tests
 */
describe('User Model:', () => {
	before(() => {
		return clearDatabase();
	});

	after(() => {
		return clearDatabase();
	});

	describe('Static Methods', () => {
		describe('create', () => {
			beforeEach(async () => {
				await clearDatabase();
			});

			afterEach(async () => {
				await clearDatabase();
			});

			it('creates with defaults', async () => {
				const user = new User(userSpec('valid'));
				await user.save();
				['user', 'editor', 'auditor', 'admin'].forEach((role) => {
					should(user.roles[role]).be.false('roles all default to false');
				});
				should(user.phone).eql('', 'phone defaults to empty');
				should(user.canProxy).be.false('canProxy defaults to false');
				should(user.canMasquerade).be.false('canMasquerade defaults to false');
				should(user.externalGroups).eql(
					[],
					'externalGroups defaults to blank array'
				);
				should(user.externalRoles).eql(
					[],
					'externalRoles defaults to blank array'
				);
				should(user.bypassAccessCheck).be.false(
					'bypassAccessCheck defaults to false'
				);
				should(user.messagesAcknowledged).eql(
					0,
					'messagesAcknowledged defaults to 0'
				);
				should(user.acceptedEua).be.null();
				should(user.lastLogin).be.null();
				should(user.lastLoginWithAccess).be.null();
				should(user.newFeatureDismissed).be.null();

				should(user.providerData).be.undefined();
				should(user.additionalProvidersData).be.undefined();
				should(user.preferences).be.undefined();
			});
		});

		describe('hasRoles', () => {
			it('should return false if the user has no roles', () => {
				const noRoleUser = { name: 'hi' };
				should(User.hasRoles(noRoleUser, ['test'])).be.false();
			});
			it('should return true if no roles are passed', () => {
				const testRoleUser = { name: 'testRole', roles: { test: true } };
				should(User.hasRoles(testRoleUser, [])).be.true();
			});
			it('should find if the user has roles or not', () => {
				const testRoleUser = { name: 'testRole', roles: { test: true } };
				const noTestRoleUser = { name: 'noTestRole', roles: { nope: true } };
				should(User.hasRoles(testRoleUser, ['test'])).be.true();
				should(User.hasRoles(noTestRoleUser, ['test'])).be.false();
			});
		});

		describe('filteredCopy', () => {
			it('should return null if null user is passed', () => {
				should(User.filteredCopy(null)).be.null();
			});
			it('should only return specific fields', () => {
				const testUser = {
					_id: 'test',
					lastLogin: undefined,
					name: 'test',
					password: 'testpwd',
					organizationLevels: 5,
					email: 'test@example.com',
					salt: 'NaCl',
					username: 'test',
					providerData: {
						dn: 'CN=test'
					},
					preferences: true
				};
				const filtered = User.filteredCopy(testUser);
				// Test that sensitive values are removed.
				['password', 'email', 'salt'].forEach((p) => {
					should(filtered[p]).be.undefined();
					delete testUser[p];
				});
				should(filtered).be.eql(testUser);
			});
		});

		describe('fullCopy', () => {
			it('should return null if null user is passed', () => {
				should(User.fullCopy(null)).be.null();
			});
			it('should only return specific fields', () => {
				const testUser = {
					_id: 'test',
					name: 'test',
					password: 'testpwd',
					organizationLevels: 5,
					email: 'test@example.com',
					salt: 'NaCl',
					username: 'test',
					providerData: {
						dn: 'CN=test'
					},
					preferences: true
				};
				testUser.toObject = () => testUser;

				const filtered = User.fullCopy(testUser);
				// Test that sensitive values are removed.
				['password', 'salt'].forEach((p) => {
					should(filtered[p]).be.undefined();
					delete testUser[p];
				});
				should(filtered).be.eql(testUser);
			});
		});

		describe('createCopy', () => {
			/**
			 * Strip fields from expectation that are not copied. This includes:
			 * - _id
			 * - providerData
			 * - salt
			 *
			 * Also, ignore matching on the "created" and "updated" date fields,
			 * since those will not necessarily match the original user.
			 * @param {object} user
			 * @returns object with user fields that should be compared after a copy
			 */
			const onlyComparableFields = (user) => {
				// By destructuring like this, we create a new object with only the
				// fields that we care to compare.
				const {
					// eslint-disable-next-line no-unused-vars
					_id,
					// eslint-disable-next-line no-unused-vars
					providerData,
					// eslint-disable-next-line no-unused-vars
					salt,
					// eslint-disable-next-line no-unused-vars
					created,
					// eslint-disable-next-line no-unused-vars
					updated,
					...userToCompare
				} = user;
				return userToCompare;
			};

			it('should only return specific fields, update time', () => {
				const now = Date.now();
				const testUser = {
					_id: 'test',
					name: 'test',
					password: 'testpwd',
					organizationLevels: 5,
					email: 'test@example.com',
					salt: 'NaCl',
					created: now,
					updated: now,
					username: 'test',
					alertsViewed: true,
					messagesAcknowledged: 5,
					newFeatureDismissed: true,
					organization: 'testorg',
					phone: '5',
					providerData: {
						dn: 'CN=test'
					},
					preferences: true
				};
				const copy = User.createCopy(testUser);

				should(copy.created).be.eql(copy.updated);
				should(copy.created >= testUser.created);

				// Test that sensitive values are removed.
				should(copy._id).be.undefined();
				should(copy.salt).be.undefined();
				should(copy.providerData).be.undefined();

				const copyUserToVerify = onlyComparableFields(copy);
				const testUserToExpect = onlyComparableFields(testUser);

				should(copyUserToVerify).be.eql(testUserToExpect);
			});
		});

		describe('auditCopy', () => {
			it('should return an object enriched by user and ip', () => {
				const now = Date.now();
				const dn = 'CN=test';
				const testUser = {
					_id: 'test',
					name: 'test',
					password: 'testpwd',
					organizationLevels: 5,
					email: 'test@example.com',
					salt: 'NaCl',
					created: now,
					updated: now,
					username: 'test',
					alertsViewed: true,
					messagesAcknowledged: 5,
					newFeatureDismissed: true,
					organization: 'testorg',
					phone: '5',
					bypassAccessCheck: true,
					canProxy: true,
					canMasquerade: false,
					providerData: {
						dn
					},
					roles: { test: true },
					preferences: true
				};
				const ip = '127.0.0.1';
				const audit = User.auditCopy(testUser, ip);
				// Strip fields from expectation that are not needed for audit.
				['created', 'password', 'providerData', 'salt', 'updated'].forEach(
					(k) => delete testUser[k]
				);
				// Alter expectation to include flattened DN and IP.
				const testUserWithDNandIP = { ...testUser, dn, ip };
				should(audit).be.eql(testUserWithDNandIP);
			});

			it('should ignore dn if no dn or providerdata is present, or flatten value', () => {
				const testUserNoDn = { name: 'test', providerData: { notdn: false } };
				should(User.auditCopy(testUserNoDn).dn).be.undefined();
				const testUserNoProvider = { name: 'test' };
				should(User.auditCopy(testUserNoProvider).dn).be.undefined();
				const testUser = { name: 'test', providerData: { dn: 'yes' } };
				should(User.auditCopy(testUser).dn).eql('yes');
			});
		});
	});

	describe('Method Save', () => {
		it('should begin with no users', () => {
			return User.find({})
				.exec()
				.then((result) => {
					should(result).be.an.Array();
					should(result).have.length(0);
				});
		});

		it('should be able to save a valid user', () => {
			const validUser = new User(userSpec('valid'));
			return validUser.save().then((result) => {
				should.exist(result);
			});
		});

		it('should result in 1 user', () => {
			return User.find({})
				.exec()
				.then((result) => {
					should(result).be.an.Array();
					should(result).have.length(1);
				});
		});

		it('should not be able to save with the same username', () => {
			const validUser = new User(userSpec('valid'));
			return validUser
				.save()
				.then(() => {
					should.fail();
				})
				.catch((err) => {
					should.exist(err);
				});
		});

		// Testing missing fields
		['name', 'organization', 'email', 'username'].forEach((field) => {
			// Creating a test case for each field
			it(`should fail to save if missing field: '${field}'`, () => {
				const u = new User(userSpec(`missing_${field}`));
				u[field] = undefined;

				return u
					.save()
					.then(() => {
						should.fail();
					})
					.catch((err) => {
						should.exist(err);
					});
			});
		});
	});
});
