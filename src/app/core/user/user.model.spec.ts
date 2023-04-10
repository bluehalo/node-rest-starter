import * as assert from 'assert';

import { Types } from 'mongoose';
import should from 'should';

import { dbs } from '../../../dependencies';
import { UserModel } from './user.model';

const User: UserModel = dbs.admin.model('User');

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
					should(userModel.roles[role]).be.false('roles all default to false');
				});
				// should.exist(userModel.roles._id);
				should(userModel.phone).eql('', 'phone defaults to empty');
				should(userModel.canProxy).be.false('canProxy defaults to false');
				should(userModel.canMasquerade).be.false(
					'canMasquerade defaults to false'
				);
				should(userModel.externalGroups).eql(
					[],
					'externalGroups defaults to blank array'
				);
				should(userModel.externalRoles).eql(
					[],
					'externalRoles defaults to blank array'
				);
				should(userModel.bypassAccessCheck).be.false(
					'bypassAccessCheck defaults to false'
				);
				should(userModel.messagesAcknowledged).eql(
					0,
					'messagesAcknowledged defaults to 0'
				);
				should(userModel.acceptedEua).be.null();
				should(userModel.lastLogin).be.null();
				should(userModel.lastLoginWithAccess).be.null();
				should(userModel.newFeatureDismissed).be.null();

				should(userModel.providerData).be.undefined();
				should(userModel.additionalProvidersData).be.undefined();
				should(userModel.preferences).be.undefined();
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
					should(filtered[p]).be.undefined();
					delete spec[p];
				});
				delete filtered._id;
				should(filtered).be.eql(spec);
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
					should(filtered[p]).be.undefined();
					delete obj[p];
				});
				should(filtered).be.eql(obj);
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

				should(copy.created).be.eql(copy.updated);
				should(copy.created >= testUser.created);

				// Test that sensitive values are removed.
				should(copy._id).be.undefined();
				should(copy.salt).be.undefined();
				should(copy.providerData).be.undefined();

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

				should(copy).be.eql(obj);
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
				should(audit).be.eql(testUserWithDNandIP);
			});

			it('should ignore dn if no dn or providerdata is present, or flatten value', () => {
				const testUserNoDn = new User({
					name: 'test',
					providerData: { notdn: false }
				});
				should(testUserNoDn.auditCopy().dn).be.undefined();
				const testUserNoProvider = new User({ name: 'test' });
				should(testUserNoProvider.auditCopy().dn).be.undefined();
				const testUser = new User({
					name: 'test',
					providerData: { dn: 'yes' }
				});
				should(testUser.auditCopy().dn).eql('yes');
			});
		});
	});

	describe('Method Save', () => {
		it('should begin with no users', async () => {
			const result = await User.find({}).exec();
			should(result).be.an.Array();
			should(result).have.length(0);
		});

		it('should be able to save a valid user', async () => {
			const validUser = new User(userSpec('valid'));
			const result = await validUser.save();
			should.exist(result);
		});

		it('should result in 1 user', async () => {
			const result = await User.find({}).exec();
			should(result).be.an.Array();
			should(result).have.length(1);
		});

		it('should not be able to save with the same username', () => {
			const validUser = new User(userSpec('valid'));
			return validUser
				.save()
				.then(() => {
					assert.fail();
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
						assert.fail();
					})
					.catch((err) => {
						should.exist(err);
					});
			});
		});
	});
});
