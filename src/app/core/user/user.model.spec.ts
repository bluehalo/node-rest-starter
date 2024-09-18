import assert from 'node:assert/strict';

import { Types } from 'mongoose';

import { User } from './user.model';

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
				const userModel = await user.save();
				['user', 'editor', 'auditor', 'admin'].forEach((role) => {
					assert.equal(
						userModel.roles[role],
						false,
						'roles all default to false'
					);
				});
				// assert(userModel.roles._id);
				assert.equal(userModel.phone, '', 'phone defaults to empty');
				assert.equal(userModel.canProxy, false, 'canProxy defaults to false');
				assert.equal(
					userModel.canMasquerade,
					false,
					'canMasquerade defaults to false'
				);
				assert.deepStrictEqual(
					userModel.externalGroups,
					[],
					'externalGroups defaults to blank array'
				);
				assert.deepStrictEqual(
					userModel.externalRoles,
					[],
					'externalRoles defaults to blank array'
				);
				assert.equal(
					userModel.bypassAccessCheck,
					false,
					'bypassAccessCheck defaults to false'
				);
				assert.equal(
					userModel.messagesAcknowledged,
					null,
					'messagesAcknowledged defaults to null'
				);
				assert.equal(userModel.acceptedEua, null);
				assert.equal(userModel.lastLogin, null);
				assert.equal(userModel.lastLoginWithAccess, null);
				assert.equal(userModel.newFeatureDismissed, null);

				assert.equal(userModel.providerData, undefined);
				assert.equal(userModel.additionalProvidersData, undefined);
				assert.equal(userModel.preferences, undefined);
			});
		});

		describe('filteredCopy', () => {
			it('should only return specific fields', () => {
				const spec = {
					lastLogin: null,
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
				const testUser = new User(spec);
				const filtered = testUser.filteredCopy();
				// Test that sensitive values are removed.
				['password', 'email', 'salt'].forEach((p) => {
					assert.equal(filtered[p], undefined);
					delete spec[p];
				});
				delete filtered._id;
				assert.deepStrictEqual(filtered, spec);
			});
		});

		describe('fullCopy', () => {
			it('should only return specific fields', () => {
				const spec = {
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
				const testUser = new User(spec);

				const filtered = testUser.fullCopy();
				const obj = testUser.toObject();
				// Test that sensitive values are removed.
				['password', 'salt'].forEach((p) => {
					assert.equal(filtered[p], undefined);
					delete obj[p];
				});
				assert.deepStrictEqual(filtered, obj);
			});
		});

		describe('createCopy', () => {
			it('should only return specific fields, update time', () => {
				const now = Date.now();
				const testUser = new User({
					_id: 'test',
					name: 'test',
					password: 'testpwd',
					organizationLevels: 5,
					email: 'test@example.com',
					salt: 'NaCl',
					username: 'test',
					alertsViewed: now,
					newFeatureDismissed: now,
					messagesAcknowledged: 5,
					organization: 'testorg',
					phone: '5',
					providerData: {
						dn: 'CN=test'
					},
					preferences: true
				});
				const copy = User.createCopy(testUser);

				// Test that sensitive values are removed.
				assert.equal(copy._id, undefined);
				assert.equal(copy.salt, undefined);
				assert.equal(copy.providerData, undefined);

				// Strip fields from expectation that are not needed for audit.
				['created', 'updated'].forEach((k) => delete copy[k]);

				const obj = testUser.toObject();
				// Strip fields from expectation that are not needed for audit.
				[
					'providerData',
					'salt',
					'acceptedEua',
					'externalGroups',
					'externalRoles',
					'id',
					'lastLogin',
					'lastLoginWithAccess',
					'bypassAccessCheck',
					'_id',
					'canMasquerade',
					'canProxy',
					'roles',
					'teams'
				].forEach((k) => delete obj[k]);

				assert.deepStrictEqual(copy, obj);
			});
		});

		describe('auditCopy', () => {
			it('should return an object enriched by user and ip', () => {
				const now = Date.now();
				const dn = 'CN=test';
				const testUser = new User({
					name: 'test',
					password: 'testpwd',
					organizationLevels: 5,
					email: 'test@example.com',
					salt: 'NaCl',
					username: 'test',
					alertsViewed: now,
					newFeatureDismissed: now,
					messagesAcknowledged: 5,
					organization: 'testorg',
					phone: '5',
					bypassAccessCheck: true,
					canProxy: true,
					canMasquerade: false,
					providerData: {
						dn
					},
					teams: [{ _id: new Types.ObjectId(), role: 'member' }],
					roles: { test: true },
					preferences: true
				});
				const ip = '127.0.0.1';
				const audit = testUser.auditCopy(ip);
				const obj = testUser.toObject();
				// Strip fields from expectation that are not needed for audit.
				[
					'created',
					'password',
					'providerData',
					'salt',
					'updated',
					'acceptedEua',
					'externalGroups',
					'externalRoles',
					'id',
					'lastLogin',
					'lastLoginWithAccess'
				].forEach((k) => delete obj[k]);
				// Alter expectation to include flattened DN and IP.
				const testUserWithDNandIP = { ...obj, dn, ip };
				assert.deepStrictEqual(audit, testUserWithDNandIP);
			});

			it('should ignore dn if no dn or providerdata is present, or flatten value', () => {
				const testUserNoDn = new User({
					name: 'test',
					providerData: { notdn: false }
				});
				assert.equal(testUserNoDn.auditCopy().dn, undefined);
				const testUserNoProvider = new User({ name: 'test' });
				assert.equal(testUserNoProvider.auditCopy().dn, undefined);
				const testUser = new User({
					name: 'test',
					providerData: { dn: 'yes' }
				});
				assert.equal(testUser.auditCopy().dn, 'yes');
			});
		});
	});

	describe('Method Save', () => {
		it('should begin with no users', async () => {
			const result = await User.find({}).exec();
			assert(Array.isArray(result));
			assert.equal(result.length, 0);
		});

		it('should be able to save a valid user', async () => {
			const validUser = new User(userSpec('valid'));
			const result = await validUser.save();
			assert(result);
		});

		it('should result in 1 user', async () => {
			const result = await User.find({}).exec();
			assert(Array.isArray(result));
			assert.equal(result.length, 1);
		});

		it('should not be able to save with the same username', () => {
			const validUser = new User(userSpec('valid'));
			return validUser
				.save()
				.then(() => {
					assert.fail();
				})
				.catch((err) => {
					assert(err);
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
						assert.fail();
					})
					.catch((err) => {
						assert(err);
					});
			});
		});
	});
});
