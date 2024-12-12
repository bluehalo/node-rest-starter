import { Query, Schema } from 'mongoose';

export interface TextSearchable {
	textSearch(search: string, sortByTextScore?: boolean): this;
}

export function textSearchPlugin<
	EnforcedDocType,
	TModelType,
	TInstanceMethods,
	TQueryHelpers extends TextSearchable
>(
	schema: Schema<EnforcedDocType, TModelType, TInstanceMethods, TQueryHelpers>
) {
	// @ts-expect-error TS doesn't like the typing on this due to specifying the type of `this`
	schema.query.textSearch = function (
		this: Query<unknown, unknown, TQueryHelpers>,
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
