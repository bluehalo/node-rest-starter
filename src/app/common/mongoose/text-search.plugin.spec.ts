import should from 'should';
import { model, Model, Schema } from 'mongoose';
import { TextSearchable, textSearchPlugin } from './text-search.plugin';

interface IExample {}
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
			should.exist(query.textSearch);

			query.textSearch.should.be.Function();
		});

		it('should not add to filter/options if search term is null/undefined/empty string', () => {
			[null, undefined, ''].forEach((search) => {
				const query = TextExample.find().textSearch(search, true);

				const filter = query.getFilter();
				should.exist(filter);
				should.not.exist(filter.$text);
				should.not.exist(query.projection());

				const options = query.getOptions();
				should.exist(options);
				should.not.exist(options.sort);
			});
		});

		it('should not add to filter/options if search term is null/undefined/empty string and sortByTextScore is false', () => {
			[null, undefined, ''].forEach((search) => {
				const query = TextExample.find().textSearch(search);

				const filter = query.getFilter();
				should.exist(filter);
				should.not.exist(filter.$text);
				should.not.exist(query.projection());

				const options = query.getOptions();
				should.exist(options);
				should.not.exist(options.sort);
			});
		});

		it('should update query filter/options', () => {
			const query = TextExample.find().textSearch('test', true);

			const filter = query.getFilter();
			should.exist(filter);
			should.exist(filter.$text);
			filter.should.containEql({ $text: { $search: 'test' } });

			should.exist(query.projection());
			query.projection().should.containEql({ score: { $meta: 'textScore' } });

			const options = query.getOptions();
			should.exist(options);
			should.exist(options.sort);
			options.sort.should.containEql({ score: { $meta: 'textScore' } });
		});

		it('should not update sort options if sortByTextScore is false', () => {
			const query = TextExample.find().textSearch('test');

			const filter = query.getFilter();
			should.exist(filter);
			should.exist(filter.$text);
			filter.should.containEql({ $text: { $search: 'test' } });

			should.exist(query.projection());
			query.projection().should.containEql({ score: { $meta: 'textScore' } });

			const options = query.getOptions();
			should.exist(options);
			should.not.exist(options.sort);
		});
	});
});
