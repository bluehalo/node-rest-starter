import assert from 'node:assert/strict';

import { CacheEntry } from './cache-entry.model';
import cacheEntryService from './cache-entry.service';

/**
 * Unit tests
 */
describe('Cache Entry Service:', () => {
	describe('CacheEntry fullCopy', () => {
		it('creates copy', () => {
			const entry = new CacheEntry({
				key: 'key',
				value: { item: 'value' },
				valueString: 'test',
				ts: Date.now()
			});

			const copy = entry.fullCopy();
			assert.deepStrictEqual(copy, {
				_id: entry._id,
				key: entry.key,
				value: entry.value,
				ts: entry.ts
			});
		});
	});

	describe('remove', () => {
		it('cache entry is removed', async () => {
			// Create cache entry
			let entry = new CacheEntry({
				key: 'key',
				value: {},
				valueString: '{}',
				ts: Date.now()
			});
			await entry.save();

			// Verify entry is in db
			entry = await CacheEntry.findById(entry._id);
			assert(entry);

			// Remove entry
			await cacheEntryService.delete(entry.key);

			// Verify entry is no longer in db
			entry = await CacheEntry.findById(entry._id);
			assert.equal(entry, null);
		});
	});

	describe('search', () => {
		beforeEach(async () => {
			await CacheEntry.deleteMany().exec();

			const entries = [...Array(100).keys()].map((index) => {
				return new CacheEntry({
					key: `key${index}`,
					value: {},
					valueString: '{}',
					ts: Date.now()
				});
			});

			await Promise.all(entries.map((entry) => entry.save()));
		});

		afterEach(async () => {
			await CacheEntry.deleteMany().exec();
		});

		it('search results page returned', async () => {
			const queryParams = { size: 10 };
			const query = null;
			const search = '';
			const { elements, ...result } = await cacheEntryService.search(
				queryParams,
				search,
				query
			);

			assert.deepStrictEqual(result, {
				pageSize: queryParams.size,
				pageNumber: 0,
				totalSize: 100,
				totalPages: 100 / queryParams.size
			});
			assert(elements);
			assert(Array.isArray(elements), 'elements should be an Array');
			assert.equal(elements.length, queryParams.size);
		});

		it('search results page returned w/ default parameters', async () => {
			const { elements, ...result } = await cacheEntryService.search();

			const pageSize = 20;

			assert.deepStrictEqual(result, {
				pageSize: pageSize,
				pageNumber: 0,
				totalSize: 100,
				totalPages: 100 / pageSize
			});
			assert(elements);
			assert(Array.isArray(elements), 'elements should be an Array');
			assert.equal(elements.length, pageSize);
		});
	});
});
