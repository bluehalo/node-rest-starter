import assert from 'node:assert/strict';

import config from 'config';
import _ from 'lodash';
import { DateTime } from 'luxon';
import { createSandbox } from 'sinon';

import accessChecker from './access-checker.service';
import { CacheEntry, ICacheEntry } from './cache/cache-entry.model';
import cacheEntryService from './cache/cache-entry.service';

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
		beforeEach(() => {
			const configGetStub = sandbox.stub(config, 'get');
			configGetStub
				.withArgs('auth.accessChecker.provider.file')
				.returns(
					'src/app/core/access-checker/providers/failure-provider.service'
				);
			configGetStub.withArgs('auth.accessChecker.provider.config').returns({});
			configGetStub.callThrough();

			// Need to clear cached provider from service to ensure proper test run.
			accessChecker.provider = null;
		});

		// Provider fails on get
		it('should not update the cache when the access checker provider fails', async () => {
			await assert.rejects(accessChecker.get('provideronly'));

			const result = await CacheEntry.findOne({ key: 'provideronly' }).exec();
			assert.equal(result, null);
		});

		// Provider fails on refresh attempt
		it('should not update the cache on refresh when the access checker provider fails', async () => {
			await assert.rejects(accessChecker.refreshEntry(spec.cache.outdated.key));

			// Query for the cache object and verify it hasn't been updated
			const result = await CacheEntry.findOne({
				_id: cache.outdated._id
			}).exec();
			assert.deepStrictEqual(result.value, spec.cache.outdated.value);
		});

		// Provider fails on refresh attempt
		it('should fail when no key is specified', async () => {
			await assert.rejects(accessChecker.refreshEntry(null));

			// Query for the cache object and verify it hasn't been updated
			const result = await CacheEntry.findOne({
				_id: cache.outdated._id
			}).exec();
			assert.deepStrictEqual(result.value, spec.cache.outdated.value);
		});
	});

	/**
	 * Test basic functionality of a working provider
	 */
	describe('Working Access Checker', () => {
		beforeEach(() => {
			const configGetStub = sandbox.stub(config, 'get');
			configGetStub
				.withArgs('auth.accessChecker.provider.file')
				.returns('src/app/core/access-checker/providers/example.provider');
			configGetStub
				.withArgs('auth.accessChecker.provider.config')
				.returns(provider);
			configGetStub.callThrough();

			// Need to clear cached provider from service to ensure proper test run.
			accessChecker.provider = null;
		});

		// Pull from cache
		it('should fail when no key is specified', async () => {
			await assert.rejects(accessChecker.get(null));
		});

		// Pull from cache
		it('should pull from cache when the entry is current and present', async () => {
			const info = await accessChecker.get(spec.cache.good.key);
			assert.deepStrictEqual(info, spec.cache.good.value);
		});

		// Pull from provider
		it('should pull from provider and update cache when entry is expired', async () => {
			const info = await accessChecker.get(spec.cache.expired.key);
			assert.deepStrictEqual(info, provider.expired);

			const result = await CacheEntry.findOne({
				key: cache.expired.key
			}).exec();
			assert.deepStrictEqual(result.value, provider.expired);
		});

		// Cache only
		it('should return the cache entry if the entry is missing from the provider', async () => {
			const info = await accessChecker.get(spec.cache.cacheonly.key);
			assert.deepStrictEqual(info, spec.cache.cacheonly.value);

			const result = await CacheEntry.findOne({
				key: cache.cacheonly.key
			}).exec();
			assert.deepStrictEqual(result.value, spec.cache.cacheonly.value);
		});

		// Provider only
		it('should update the cache when pulling from the provider', async () => {
			const info = await accessChecker.get('provideronly');
			assert.deepStrictEqual(info, provider.provideronly);

			const result = await CacheEntry.findOne({ key: 'provideronly' }).exec();
			assert.deepStrictEqual(result.value, provider.provideronly);
		});

		// Pull from provider
		it('should pull from provider and return result even if cache update fails', async () => {
			sandbox.stub(cacheEntryService, 'upsert').rejects(new Error('error'));
			const info = await accessChecker.get('provideronly');
			assert.deepStrictEqual(info, provider.provideronly);
		});

		// Refresh cache entry
		it('should refresh the cache when forced', async () => {
			// should return the info from the cache
			await accessChecker.refreshEntry('provideronly');

			const result = await CacheEntry.findOne({
				key: 'provideronly'
			}).exec();

			assert.deepStrictEqual(result.value, provider.provideronly);
		});
	});

	/**
	 * Test functionality with missing access checker config
	 */
	describe('Missing Access Checker Config', () => {
		beforeEach(() => {
			// Need to clear cached provider from service to ensure proper test run.
			accessChecker.provider = null;
		});

		// Provider fails on get
		it('should throw error when no provider is configured', async () => {
			await assert.rejects(
				accessChecker.get('notincache'),
				new Error(
					'Error retrieving entry from the access checker provider: Configuration property "auth.accessChecker.provider.file" is not defined'
				)
			);
		});
	});

	/**
	 * Test functionality with missing access checker provider file
	 */
	describe('Invalid Access Checker Config', () => {
		beforeEach(() => {
			const configGetStub = sandbox.stub(config, 'get');
			configGetStub
				.withArgs('auth.accessChecker.provider.file')
				.returns('invalid/path/to/provider');
			configGetStub.withArgs('auth.accessChecker.provider.config').returns({});
			configGetStub.callThrough();

			// Need to clear cached provider from service to ensure proper test run.
			accessChecker.provider = null;
		});

		// Provider fails on get
		it('should throw error when provider is configured with invalid file path', async () => {
			await assert.rejects(accessChecker.get('notincache'), {
				message:
					'Error retrieving entry from the access checker provider: Failed to load access checker provider.'
			});
		});
	});
});
