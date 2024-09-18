import assert from 'node:assert/strict';

import { model, Model, Schema } from 'mongoose';

import {
	ContainsSearchable,
	containsSearchPlugin
} from './contains-search.plugin';

interface IExample {
	field: string;
}
type ExampleModel = Model<IExample, ContainsSearchable>;

const ContainsExampleSchema = new Schema<IExample, ExampleModel>({
	field: String
});
ContainsExampleSchema.plugin(containsSearchPlugin);

const ContainsExample = model<IExample, ExampleModel>(
	'ContainsExample',
	ContainsExampleSchema
);

const ContainsExample2Schema = new Schema<IExample, ExampleModel>({
	field: String
});
ContainsExample2Schema.plugin(containsSearchPlugin, {
	fields: ['field1', 'field2']
});

const ContainsExample2 = model<IExample, ExampleModel>(
	'ContainsExample2',
	ContainsExample2Schema
);

/**
 * Unit tests
 */
describe('Contains Search Plugin:', () => {
	describe('containsSearch:', () => {
		it('should add containsSearch function to query', () => {
			const query = ContainsExample.find();
			assert(query.containsSearch);
			assert.equal(typeof query.containsSearch, 'function');
		});

		it('should not add to filter if search term is null/undefined/empty string', () => {
			[null, undefined, ''].forEach((search) => {
				const query = ContainsExample.find().containsSearch(search);

				const filter = query.getFilter();

				assert.deepStrictEqual(filter, {});
			});
		});

		it('should not add to filter if field list is empty', () => {
			[null, []].forEach((fields) => {
				const query = ContainsExample.find().containsSearch('test', fields);

				const filter = query.getFilter();

				assert.deepStrictEqual(filter, {});
			});
		});

		it('should use provided fields list', () => {
			const query = ContainsExample.find().containsSearch('test', [
				'field1',
				'field2',
				'field3'
			]);

			const filter = query.getFilter();

			assert.deepStrictEqual(filter, {
				$or: [
					{ field1: { $regex: /test/gim } },
					{ field2: { $regex: /test/gim } },
					{ field3: { $regex: /test/gim } }
				]
			});
		});

		it('should not create $or if only one field in list', () => {
			const query = ContainsExample.find().containsSearch('test', ['field1']);

			const filter = query.getFilter();

			assert.deepStrictEqual(filter, {
				field1: { $regex: /test/gim }
			});
		});

		it('should use default fields list in pluginOptions', () => {
			const query = ContainsExample2.find().containsSearch('test');

			const filter = query.getFilter();

			assert.deepStrictEqual(filter, {
				$or: [
					{ field1: { $regex: /test/gim } },
					{ field2: { $regex: /test/gim } }
				]
			});
		});
	});
});
