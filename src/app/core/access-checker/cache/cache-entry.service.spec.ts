import should from 'should';

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
			should.exist(copy);
			copy.key.should.equal(entry.key);
			copy.value.should.equal(entry.value);
			copy.ts.should.equal(entry.ts);
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
			should.exist(entry);

			// Remove entry
			await cacheEntryService.delete(entry.key);

			// Verify entry is no longer in db
			entry = await CacheEntry.findById(entry._id);
			should.not.exist(entry);
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
			const result = await cacheEntryService.search(queryParams, search, query);

			should.exist(result);
			result.totalSize.should.equal(100);
			result.pageSize.should.equal(queryParams.size);
			result.pageNumber.should.equal(0);
			result.totalPages.should.equal(100 / queryParams.size);
			result.elements.should.be.an.Array();
			result.elements.length.should.be.equal(queryParams.size);
		});

		it('search results page returned w/ default parameters', async () => {
			const result = await cacheEntryService.search();

			const pageSize = 20;

			should.exist(result);
			result.totalSize.should.equal(100);
			result.pageSize.should.equal(pageSize);
			result.pageNumber.should.equal(0);
			result.totalPages.should.equal(100 / pageSize);
			result.elements.should.be.an.Array();
			result.elements.length.should.be.equal(pageSize);
		});
	});
});
