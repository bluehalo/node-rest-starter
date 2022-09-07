const should = require('should'),
	mongoose = require('mongoose'),
	paginatePlugin = require('./paginate.plugin');

const PaginateExampleSchema = new mongoose.Schema({ field: String });
PaginateExampleSchema.plugin(paginatePlugin);

const PaginateExample =
	/** @type {mongoose.Model<any, import('./types').PaginatePlugin>} */ (
		mongoose.model('PaginateExample', PaginateExampleSchema)
	);

/**
 * Unit tests
 */
describe('Paging Search Plugin:', () => {
	before(() => {
		const items = [];
		for (let i = 1; i <= 100; i++) {
			items.push(
				new PaginateExample({
					field: i
				})
			);
		}
		return PaginateExample.create(items);
	});

	after(() => {
		return PaginateExample.deleteMany({}).exec();
	});

	it('should add paginate function to query', () => {
		const query = PaginateExample.find();
		should.exist(query.paginate);

		query.paginate.should.be.Function();
	});

	it('should return promise', () => {
		const promise = PaginateExample.find().paginate(10, 1);

		promise.then.should.be.an.instanceof(Function);
	});

	it('should return specified page of data', async () => {
		const result = await PaginateExample.find().paginate(10, 5);
		should.exist(result);
		result.should.be.containEql({
			pageSize: 10,
			pageNumber: 5,
			totalSize: 100,
			totalPages: 10
		});
		should.exist(result.elements);
		result.elements.should.be.an.Array();
		result.elements.length.should.equal(10);
	});

	it('should return empty/first page if no data found', async () => {
		const result = await PaginateExample.find({ field: 'invalid' }).paginate(
			10,
			5
		);
		should.exist(result);
		result.should.be.containEql({
			pageSize: 10,
			pageNumber: 0,
			totalSize: 0,
			totalPages: 0
		});
		should.exist(result.elements);
		result.elements.should.be.an.Array();
		result.elements.length.should.equal(0);
	});

	it('should return page with expected metadata when runCount = false', async () => {
		const result = await PaginateExample.find().paginate(10, 5, false);
		should.exist(result);
		result.should.be.containEql({
			pageSize: 10,
			pageNumber: 5,
			totalSize: Number.MAX_SAFE_INTEGER,
			totalPages: Math.ceil(Number.MAX_SAFE_INTEGER / 10)
		});
		should.exist(result.elements);
		result.elements.should.be.an.Array();
		result.elements.length.should.equal(10);
	});
});
