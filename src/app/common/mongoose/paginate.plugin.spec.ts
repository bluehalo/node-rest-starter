import assert from 'node:assert/strict';

import { HydratedDocument, model, Model, Schema } from 'mongoose';

import { Paginateable, paginatePlugin } from './paginate.plugin';

interface IExample {
	field: string;
}
type ExampleModel = Model<IExample, Paginateable<HydratedDocument<IExample>>>;

const PaginateExampleSchema = new Schema<IExample, ExampleModel>({
	field: String
});
PaginateExampleSchema.plugin(paginatePlugin);

const PaginateExample = model<IExample, ExampleModel>(
	'PaginateExample',
	PaginateExampleSchema
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
		assert(query.paginate);
		assert.equal(typeof query.paginate, 'function');
	});

	it('should return promise', () => {
		const promise = PaginateExample.find().paginate(10, 1);

		assert(promise instanceof Promise);
	});

	it('should return specified page of data', async () => {
		const { elements, ...result } = await PaginateExample.find().paginate(
			10,
			5
		);
		assert.deepStrictEqual(result, {
			pageSize: 10,
			pageNumber: 5,
			totalSize: 100,
			totalPages: 10
		});
		assert(elements);
		assert(Array.isArray(elements), 'elements should be an Array');
		assert.equal(elements.length, 10);
	});

	it('should return empty/first page if no data found', async () => {
		const { elements, ...result } = await PaginateExample.find({
			field: 'invalid'
		}).paginate(10, 5);

		assert.deepStrictEqual(result, {
			pageSize: 10,
			pageNumber: 0,
			totalSize: 0,
			totalPages: 0
		});

		assert(elements);
		assert(Array.isArray(elements), 'elements should be an Array');
		assert.equal(elements.length, 0);
	});

	it('should return page with expected metadata when runCount = false', async () => {
		const { elements, ...result } = await PaginateExample.find().paginate(
			10,
			5,
			false
		);

		assert.deepStrictEqual(result, {
			pageSize: 10,
			pageNumber: 5,
			totalSize: Number.MAX_SAFE_INTEGER,
			totalPages: Math.ceil(Number.MAX_SAFE_INTEGER / 10)
		});

		assert(elements);
		assert(Array.isArray(elements), 'elements should be an Array');
		assert.equal(elements.length, 10);
	});
});
