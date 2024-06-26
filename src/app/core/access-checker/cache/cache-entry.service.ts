import { FilterQuery } from 'mongoose';

import {
	CacheEntry,
	CacheEntryDocument,
	CacheEntryModel
} from './cache-entry.model';
import { utilService } from '../../../../dependencies';
import { PagingResults } from '../../../common/mongoose/paginate.plugin';

class CacheEntryService {
	constructor(private model: CacheEntryModel) {}

	/**
	 * Get the entry from the cache. Gets the most recent version.
	 * @param key The unique identifier for the entry to get
	 * @returns The retrieved cache value
	 */
	read(key: string): Promise<CacheEntryDocument | null> {
		return this.model.findOne({ key }).sort({ ts: -1 }).exec();
	}

	/**
	 * Put the entry in the cache
	 * @param key The unique identifier for the entry
	 * @param value The entry info object
	 */
	upsert(
		key: string,
		value: Record<string, unknown>
	): Promise<CacheEntryDocument> {
		// Convert the value to a string that's searchable
		const valueString = JSON.stringify(value);

		// Upsert the cache entry
		return this.model
			.findOneAndUpdate(
				{ key },
				{ value, valueString, ts: Date.now() },
				{ new: true, upsert: true }
			)
			.exec();
	}

	/**
	 * Delete the entry in the cache
	 * @param key The unique identifier for the entry
	 */
	async delete(key: string): Promise<CacheEntryDocument | null> {
		const doc = await this.model.findOne({ key }).exec();
		await doc.deleteOne();
		return doc;
	}

	search(
		queryParams = {},
		search = '',
		query: FilterQuery<CacheEntryDocument> = {}
	): Promise<PagingResults<CacheEntryDocument>> {
		const page = utilService.getPage(queryParams);
		const limit = utilService.getLimit(queryParams);
		const sort = utilService.getSortObj(queryParams);

		// Query for cache entries
		return this.model
			.find(query)
			.containsSearch(search)
			.sort(sort)
			.paginate(limit, page);
	}
}

export = new CacheEntryService(CacheEntry);
