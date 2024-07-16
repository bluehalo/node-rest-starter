import { Schema, model, HydratedDocument, Model, Types } from 'mongoose';

import {
	ContainsSearchable,
	containsSearchPlugin
} from '../../../common/mongoose/contains-search.plugin';
import getterPlugin from '../../../common/mongoose/getter.plugin';
import {
	paginatePlugin,
	Paginateable
} from '../../../common/mongoose/paginate.plugin';

export interface ICacheEntry {
	_id: Types.ObjectId;
	key: string;
	ts: Date;
	value: Record<string, unknown>;
	valueString: string;
}

export interface ICacheEntryMethods {
	fullCopy(): Record<string, unknown>;
}

export type CacheEntryDocument = HydratedDocument<
	ICacheEntry,
	ICacheEntryMethods,
	ICacheEntryQueryHelpers
>;

type ICacheEntryQueryHelpers = ContainsSearchable &
	Paginateable<CacheEntryDocument>;

export type CacheEntryModel = Model<
	ICacheEntry,
	ICacheEntryQueryHelpers,
	ICacheEntryMethods
>;

/**
 * Schema Declaration
 */
const CacheEntrySchema = new Schema<
	ICacheEntry,
	CacheEntryModel,
	ICacheEntryMethods,
	ICacheEntryQueryHelpers
>({
	// The external id of this entry
	key: {
		type: String,
		trim: true
	},

	// The actual ts this entry was entered into the cache
	ts: {
		type: Date,
		default: () => Date.now()
	},

	// The value of the entry
	value: {},

	// The value of the entry, in string format
	valueString: {
		type: String
	}
});

CacheEntrySchema.plugin(getterPlugin);
CacheEntrySchema.plugin(paginatePlugin);
CacheEntrySchema.plugin(containsSearchPlugin, {
	fields: ['key', 'valueString']
});

/**
 * Index declarations
 */
CacheEntrySchema.index({ ts: -1 });
CacheEntrySchema.index({ key: 1 });

/**
 * Lifecycle hooks
 */

/**
 * Instance Methods
 */

CacheEntrySchema.methods.fullCopy = function () {
	const entry: Record<string, unknown> = {};
	entry._id = this._id;
	entry.key = this.key;
	entry.ts = this.ts;
	entry.value = this.value;

	return entry;
};

/**
 * Register the Schema with Mongoose
 */
export const CacheEntry = model<ICacheEntry, CacheEntryModel>(
	'CacheEntry',
	CacheEntrySchema,
	'cache.entry'
);
