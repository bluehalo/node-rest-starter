const should = require('should'),
	mongoose = require('mongoose'),
	textSearchPlugin = require('./text-search.plugin');

const TextExampleSchema = new mongoose.Schema({ field: String });
TextExampleSchema.plugin(textSearchPlugin);
const TextExample = mongoose.model('TextExample', TextExampleSchema);

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
			const query = TextExample.find().textSearch('test');

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
	});
});
