'use strict';

const
	_ = require('lodash'),
	rewire = require('rewire'),
	should = require('should');

const pagingSearchPlugin = rewire('../../common/mongoose/paging-search.plugin');

/**
 * Unit tests
 */
describe('Paging Search Plugin:', () => {

	describe('generateSort:', () => {
		const tests = [{
			input: null,
			expected: {},
			description: 'null sortArr'
		}, {
			input: [],
			expected: {},
			description: 'empty sortArr'
		}, {
			input: [{
				property: 'field1',
				direction: 'ASC'
			}],
			expected: { field1: 1 },
			description: 'single ascending entry sortArr'
		}, {
			input: [{
				property: 'field1',
				direction: 'DESC'
			}],
			expected: { field1: -1 },
			description: 'single descending entry sortArr'
		}, {
			input: [{
				property: 'field1',
				direction: 'DESC'
			}, {
				property: 'field2',
				direction: 'ASC'
			}],
			expected: { field1: -1, field2: 1 },
			description: 'multiple entry sortArr'
		}];

		tests.forEach((test) => {
			it(test.description, () => {
				const result = pagingSearchPlugin.__get__('generateSort')(test.input);
				should.exist(result);
				_.isEqual(result, test.expected).should.be.true(`expected ${JSON.stringify(result)} to equal ${JSON.stringify(test.expected)}`);
			});
		});
	});

	describe('searchContainsQuery:', () => {
		const tests = [{
			input: {
				query: null,
				fields: null,
				search: null
			},
			expected: {},
			description: 'null query; null fields; null search'
		}, {
			input: {
				query: null,
				fields: null,
				search: ''
			},
			expected: {},
			description: 'null query; null fields; empty search'
		}, {
			input: {
				query: null,
				fields: [],
				search: null
			},
			expected: {},
			description: 'null query; empty fields; null search'
		}, {
			input: {
				query: {},
				fields: null,
				search: null
			},
			expected: {},
			description: 'empty query; null fields; null search'
		}, {
			input: {
				query: {},
				fields: null,
				search: ''
			},
			expected: {},
			description: 'empty query; null fields; empty search'
		}, {
			input: {
				query: {},
				fields: [],
				search: null
			},
			expected: {},
			description: 'empty query; empty fields; null search'
		}, {
			input: {
				query: {},
				fields: [],
				search: ''
			},
			expected: {},
			description: 'empty query; empty fields; empty search'
		}, {
			input: {
				query: {},
				fields: ['field1'],
				search: ''
			},
			expected: {},
			description: 'single field, empty search'
		}, {
			input: {
				query: {},
				fields: ['field1', 'field2'],
				search: ''
			},
			expected: {},
			description: 'multiple fields, empty search'
		}, {
			input: {
				query: {},
				fields: ['field1'],
				search: 'test'
			},
			expected: {
				$or: [
					{ field1: { '$regex': /test/gim } }
				]
			},
			description: 'single field, valid search'
		}, {
			input: {
				query: {},
				fields: ['field1', 'field2'],
				search: 'test'
			},
			expected: {
				$or: [
					{ field1: { '$regex': /test/gim } },
					{ field2: { '$regex': /test/gim } }
				]
			},
			description: 'multiple fields, valid search'
		}, {
			input: {
				query: { field3: 'testing' },
				fields: ['field1', 'field2'],
				search: 'test'
			},
			expected: {
				field3: 'testing',
				$or: [
					{ field1: { '$regex': /test/gim } },
					{ field2: { '$regex': /test/gim } }
				]
			},
			description: 'multiple fields, valid search, w/query'
		}];

		tests.forEach((test) => {
			it(test.description, () => {
				pagingSearchPlugin.__with__({
					pagingQuery: (schema, filter) => {
						_.isEqual(filter, test.expected).should.be.true(`expected filter ${JSON.stringify(filter)} to equal ${JSON.stringify(test.expected)}`);
					}
				})(() => {
					pagingSearchPlugin.__get__('searchContainsQuery')(null, test.input.query, test.input.fields, test.input.search);
				});
			});
		});
	});

	describe('searchTextQuery:', () => {
		const tests = [{
			input: {
				query: null,
				search: null
			},
			expected: {
				filter: {},
				projection: {},
				sort: {}
			},
			description: 'null query; null search'
		}, {
			input: {
				query: null,
				search: ''
			},
			expected: {
				filter: {},
				projection: {},
				sort: {}
			},
			description: 'null query; empty search'
		}, {
			input: {
				query: {},
				search: null
			},
			expected: {
				filter: {},
				projection: {},
				sort: {}
			},
			description: 'empty query; null search'
		}, {
			input: {
				query: {},
				search: ''
			},
			expected: {
				filter: {},
				projection: {},
				sort: {}
			},
			description: 'empty query; empty search'
		}, {
			input: {
				query: {},
				search: 'test'
			},
			expected: {
				filter: { $text: { $search: 'test' } },
				projection: { score: { $meta: 'textScore' } },
				sort: { score: { $meta: 'textScore' } }
			},
			description: 'valid search'
		}, {
			input: {
				query: { field1: 'test'},
				search: 'test'
			},
			expected: {
				filter: {
					field1: 'test',
					$text: { $search: 'test' }
				},
				projection: { score: { $meta: 'textScore' } },
				sort: { score: { $meta: 'textScore' } }
			},
			description: 'valid search'
		}];

		tests.forEach((test) => {
			it(test.description, () => {
				pagingSearchPlugin.__with__({
					pagingQuery: (schema, filter, projection, options, sort) => {
						_.isEqual(filter, test.expected.filter).should.be.true(`expected filter ${JSON.stringify(filter)} to equal ${JSON.stringify(test.expected.filter)}`);
						_.isEqual(projection, test.expected.projection).should.be.true(`expected projection ${JSON.stringify(projection)} to equal ${JSON.stringify(test.expected.projection)}`);
						_.isEqual(sort, test.expected.sort).should.be.true(`expected sort ${JSON.stringify(sort)} to equal ${JSON.stringify(test.expected.sort)}`);
					}
				})(() => {
					pagingSearchPlugin.__get__('searchTextQuery')(null, test.input.query, test.input.search);
				});
			});
		});
	});

	describe('plugin', () => {
		it('plugin should add static methods to schema', () => {
			const schemaMock = {statics: {}};

			pagingSearchPlugin(schemaMock);

			should.exist(schemaMock.statics.textSearch);
			should.exist(schemaMock.statics.containsSearch);

			schemaMock.statics.textSearch.should.be.Function();
			schemaMock.statics.containsSearch.should.be.Function();

			let searchTextQueryCalled = false;
			let searchContainsQueryCalled = false;

			pagingSearchPlugin.__with__({
				searchTextQuery: () => { searchTextQueryCalled = true; },
				searchContainsQuery: () => { searchContainsQueryCalled = true; }
			})(() => {
				schemaMock.statics.textSearch();
				schemaMock.statics.containsSearch();
			});

			searchTextQueryCalled.should.be.true('expected searchTextQueryCalled to be called');
			searchContainsQueryCalled.should.be.true('expected searchContainsQueryCalled to be called');
		});
	});
});
