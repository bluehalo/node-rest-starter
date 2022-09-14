import { Schema } from 'mongoose';

export interface TextSearchable {
	textSearch(search: string, sortByTextScore?: boolean): this;
}

export function textSearchPlugin(schema: Schema) {
	schema.query['textSearch'] = function (
		search: string,
		sortByTextScore = false
	) {
		if (null == search || '' === search) {
			return this;
		}

		const query = this.where({ $text: { $search: search } }).select({
			score: { $meta: 'textScore' }
		});

		if (sortByTextScore) {
			return query.sort({
				...this.getOptions().sort,
				score: { $meta: 'textScore' }
			});
		}
		return query;
	};
}
