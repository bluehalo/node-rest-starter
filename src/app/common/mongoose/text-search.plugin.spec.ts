import assert from 'node:assert/strict';

import { model, Model, Schema } from 'mongoose';

import { TextSearchable, textSearchPlugin } from './text-search.plugin';

interface IExample {
	field: string;
}
type ExampleModel = Model<IExample, TextSearchable>;
const TextExampleSchema = new Schema<IExample, ExampleModel>({
	field: String
});
TextExampleSchema.plugin(textSearchPlugin);

const TextExample = model<IExample, ExampleModel>(
	'TextExample',
	TextExampleSchema
);

/**
 * Unit tests
 */
describe('Text Search Plugin:', () => {
	describe('textSearch:', () => {
		it('should add textSearch function to query', () => {
			const query = TextExample.find();
			assert(query.textSearch);
			assert.equal(typeof query.textSearch, 'function');
		});

		it('should not add to filter/options if search term is null/undefined/empty string', () => {
			[null, undefined, ''].forEach((search) => {
				[true, false].forEach((sortByTextScore) => {
					const query = TextExample.find().textSearch(search, sortByTextScore);

					const filter = query.getFilter();
					assert.deepStrictEqual(filter, {});

					assert.equal(query.projection(), undefined);

					const options = query.getOptions();
					assert(options);
					assert.deepStrictEqual(options.sort, undefined);
				});
			});
		});

		it('should update query filter/options', () => {
			const query = TextExample.find().textSearch('test', true);

			const filter = query.getFilter();

			assert.deepStrictEqual(filter, { $text: { $search: 'test' } });

			assert.deepStrictEqual(query.projection(), {
				score: { $meta: 'textScore' }
			});

			const options = query.getOptions();
			assert(options);
			assert.deepStrictEqual(options.sort, { score: { $meta: 'textScore' } });
		});

		it('should not update sort options if sortByTextScore is false', () => {
			const query = TextExample.find().textSearch('test');

			const filter = query.getFilter();

			assert.deepStrictEqual(filter, {
				$text: { $search: 'test' }
			});

			assert.deepStrictEqual(query.projection(), {
				score: { $meta: 'textScore' }
			});

			const options = query.getOptions();
			assert(options);
			assert.equal(options.sort, undefined);
		});
	});
});
