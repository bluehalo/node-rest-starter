import _ from 'lodash';
import { DateTime } from 'luxon';
import should from 'should';
import { createSandbox } from 'sinon';

import { config, dbs } from '../../../dependencies';
import accessChecker from './access-checker.service';
import { CacheEntryModel, ICacheEntry } from './cache/cache-entry.model';
import cacheEntryService from './cache/cache-entry.service';

const CacheEntry = dbs.admin.model('CacheEntry') as CacheEntryModel;

/**
 * Helpers
 */
function clearDatabase() {
	return CacheEntry.deleteMany({}).exec();
}

function cacheSpec(key): ICacheEntry {
	return {
		key: key.toLowerCase(),
		value: {
			name: `${key} Name`,
			organization: `${key} Organization`,
			email: `${key}@mail.com`,
			username: `${key}_username`,
			roles: ['role1', 'role2'],
			groups: ['group1', 'group2']
		}
	} as unknown as ICacheEntry;
}

function providerSpec(key) {
	return {
		name: `${key} Name`,
		organization: `${key} Organization`,
		email: `${key}@mail.com`,
		username: `${key}_username`,
		roles: ['role1', 'role2'],
		groups: ['group1', 'group2']
	};
}

function validateCacheEntry(actual, expected) {
	should.exist(actual);
	should(actual.name).equal(expected.name);
	should(actual.organization).equal(expected.organization);
	should(actual.email).equal(expected.email);
	should(actual.username).equal(expected.username);

	should(actual.roles).be.an.Array();
	should(actual.roles).have.length(expected.roles.length);
	should(actual.roles).containDeep(expected.roles);

	should(actual.groups).be.an.Array();
	should(actual.groups).have.length(expected.groups.length);
	should(actual.groups).containDeep(expected.groups);
}

/**
 * Unit tests
 */
describe('Access Checker Service:', () => {
	let sandbox;

	// Specs for tests
	const spec: { cache: { [key: string]: ICacheEntry } } = {
		cache: {}
	};
	const provider: { [key: string]: Record<string, unknown> } = {};

	// Cache and provider agree, entry is current
	spec.cache.good = cacheSpec('good');
	provider.good = providerSpec('good');

	// Cache and provider disagree, entry is expired
	spec.cache.expired = cacheSpec('expired');
	spec.cache.expired.ts = DateTime.now()
		.minus({
			milliseconds: 1000 * 60 * 60 * 24 * 10
		})
		.toJSDate();
	provider.expired = providerSpec('expirednew');

	// Cache and provider disagree, entry key not expired
	spec.cache.outdated = cacheSpec('outdated');
	spec.cache.outdated.ts = DateTime.now()
		.minus({
			milliseconds: 1000 * 60 * 60 * 24 * 10
		})
		.toJSDate();
	provider.outdated = providerSpec('outdatednew');

	// Cache has entry that is now missing from provider
	spec.cache.cacheonly = cacheSpec('cacheonly');

	// Entry is only in the provider
	provider.provideronly = providerSpec('provideronly');

	const cache: { [key: string]: ICacheEntry } = {};

	beforeEach(async () => {
		sandbox = createSandbox();

		await clearDatabase();
		await Promise.all(
			_.keys(spec.cache).map((k) => {
				return new CacheEntry(spec.cache[k]).save().then((value) => {
					cache[k] = value;
				});
			})
		);
	});

	afterEach(async () => {
		sandbox.restore();

		await clearDatabase();
	});

	/**
	 * Test functionality with the access checker provider fails
	 */
	describe('Broken Access Checker', () => {
		let originalAuth;
		before(() => {
			originalAuth = config.auth;
			// All the data is loaded, so initialize proxy-pki
			config.auth.accessChecker = {
				provider: {
					file: 'src/app/core/access-checker/providers/failure-provider.service',
					config: {}
				}
			};

			// Need to clear cached provider from service to ensure proper test run.
			accessChecker.provider = null;
		});

		after(() => {
			config.auth = originalAuth;
		});

		// Provider fails on get
		it('should not update the cache when the access checker provider fails', async () => {
			let err;
			try {
				await accessChecker.get('provideronly');
			} catch (e) {
				err = e;
			}

			// Should have errored
			should.exist(err);

			const result = await CacheEntry.findOne({ key: 'provideronly' }).exec();
			should.not.exist(result);
		});

		// Provider fails on refresh attempt
		it('should not update the cache on refresh when the access checker provider fails', async () => {
			let err;
			try {
				await accessChecker.refreshEntry(spec.cache.outdated.key);
			} catch (e) {
				err = e;
			}
			// Should have errored
			should.exist(err);

			// Query for the cache object and verify it hasn't been updated
			const result = await CacheEntry.findOne({
				_id: cache.outdated._id
			}).exec();
			validateCacheEntry(result.value, spec.cache.outdated.value);
		});

		// Provider fails on refresh attempt
		it('should fail when no key is specified', async () => {
			let err;
			try {
				await accessChecker.refreshEntry(null);
			} catch (e) {
				err = e;
			}
			// Should have errored
			should.exist(err);

			// Query for the cache object and verify it hasn't been updated
			const result = await CacheEntry.findOne({
				_id: cache.outdated._id
			}).exec();
			validateCacheEntry(result.value, spec.cache.outdated.value);
		});
	});

	/**
	 * Test basic functionality of a working provider
	 */
	describe('Working Access Checker', () => {
		let originalAuth;
		before(() => {
			originalAuth = config.auth;

			// All the data is loaded, so initialize proxy-pki
			config.auth.accessChecker = {
				provider: {
					file: 'src/app/core/access-checker/providers/example.provider',
					config: provider
				}
			};

			// Need to clear cached provider from service to ensure proper test run.
			accessChecker.provider = null;
		});

		after(() => {
			config.auth = originalAuth;
		});

		// Pull from cache
		it('should fail when no key is specified', async () => {
			let err;
			try {
				await accessChecker.get(null);
			} catch (e) {
				err = e;
			}
			should.exist(err);
		});

		// Pull from cache
		it('should pull from cache when the entry is current and present', async () => {
			const info = await accessChecker.get(spec.cache.good.key);
			validateCacheEntry(info, spec.cache.good.value);
		});

		// Pull from provider
		it('should pull from provider and update cache when entry is expired', async () => {
			const info = await accessChecker.get(spec.cache.expired.key);
			validateCacheEntry(info, provider.expired);

			const result = await CacheEntry.findOne({
				key: cache.expired.key
			}).exec();
			validateCacheEntry(result.value, provider.expired);
		});

		// Cache only
		it('should return the cache entry if the entry is missing from the provider', async () => {
			const info = await accessChecker.get(spec.cache.cacheonly.key);
			validateCacheEntry(info, spec.cache.cacheonly.value);

			const result = await CacheEntry.findOne({
				key: cache.cacheonly.key
			}).exec();
			validateCacheEntry(result.value, spec.cache.cacheonly.value);
		});

		// Provider only
		it('should update the cache when pulling from the provider', async () => {
			const info = await accessChecker.get('provideronly');
			validateCacheEntry(info, provider.provideronly);

			const result = await CacheEntry.findOne({ key: 'provideronly' }).exec();
			validateCacheEntry(result.value, provider.provideronly);
		});

		// Pull from provider
		it('should pull from provider and return result even if cache update fails', async () => {
			sandbox.stub(cacheEntryService, 'upsert').rejects(new Error('error'));
			const info = await accessChecker.get('provideronly');
			validateCacheEntry(info, provider.provideronly);
		});

		// Refresh cache entry
		it('should refresh the cache when forced', async () => {
			// should return the info from the cache
			await accessChecker.refreshEntry('provideronly');

			const result = await CacheEntry.findOne({
				key: 'provideronly'
			}).exec();

			validateCacheEntry(result.value, provider.provideronly);
		});
	});

	/**
	 * Test functionality with missing access checker config
	 */
	describe('Missing Access Checker Config', () => {
		let originalAuth;
		before(() => {
			originalAuth = config.auth;
			// All the data is loaded, so initialize proxy-pki
			config.auth.accessChecker = {
				provider: {}
			};

			// Need to clear cached provider from service to ensure proper test run.
			accessChecker.provider = null;
		});

		after(() => {
			config.auth = originalAuth;
		});

		// Provider fails on get
		it('should throw error when no provider is configured', async () => {
			let err;
			try {
				await accessChecker.get('notincache');
			} catch (e) {
				err = e;
			}

			// Should have errored
			should.exist(err?.message);
			err.message.should.equal(
				'Error retrieving entry from the access checker provider: Invalid accessChecker provider configuration.'
			);
		});
	});

	/**
	 * Test functionality with missing access checker provider file
	 */
	describe('Missing Access Checker Config', () => {
		let originalAuth;
		before(() => {
			originalAuth = config.auth;
			// All the data is loaded, so initialize proxy-pki
			config.auth.accessChecker = {
				provider: {
					file: 'invalid/path/to/provider'
				}
			};

			// Need to clear cached provider from service to ensure proper test run.
			accessChecker.provider = null;
		});

		after(() => {
			config.auth = originalAuth;
		});

		// Provider fails on get
		it('should throw error when provider is configured with invalid file path', async () => {
			let err;
			try {
				await accessChecker.get('notincache');
			} catch (e) {
				err = e;
			}

			// Should have errored
			should.exist(err?.message);
			err.message.should.equal(
				'Error retrieving entry from the access checker provider: Failed to load access checker provider.'
			);
		});
	});
});
