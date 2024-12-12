import assert from 'node:assert/strict';

import { DateTime } from 'luxon';
import { Types } from 'mongoose';

import { utilService } from '../../dependencies';

/**
 * Globals
 */

// eslint-disable-next-line @typescript-eslint/no-empty-function
const emptyFn = () => {};

/**
 * Unit tests
 */
describe('Utils:', () => {
	describe('toMongoose:', () => {
		it('should convert $date : {""} to new Date("")', () => {
			const input = {
				hello: {
					there: 'you are',
					when: [
						{},
						{ something: 0 },
						{ date: { $date: '2015-01-01T00:00:00.000Z' } }
					]
				},
				date: { $date: '2015-07-01T00:00:00.000Z' }
			};

			const output = utilService.toMongoose(input);
			assert.deepStrictEqual(output, {
				hello: {
					there: 'you are',
					when: [
						{},
						{ something: 0 },
						{ date: DateTime.fromISO('2015-01-01T00:00:00.000Z').toJSDate() }
					]
				},
				date: DateTime.fromISO('2015-07-01T00:00:00.000Z').toJSDate()
			});
		});

		it('should convert $obj : {""} to new mongoose.Types.ObjectId("")', () => {
			const input = {
				hello: {
					there: 'you are',
					when: [
						{},
						{ something: 0 },
						{ obj: { $obj: '000000000000000000000000' } }
					]
				},
				obj: { $obj: '000000000000000000000001' }
			};

			const output = utilService.toMongoose(input);
			assert.deepStrictEqual(output, {
				hello: {
					there: 'you are',
					when: [
						{},
						{ something: 0 },
						{ obj: new Types.ObjectId('000000000000000000000000') }
					]
				},
				obj: new Types.ObjectId('000000000000000000000001')
			});
		});
	});

	describe('Date Parse:', () => {
		it('returns null if null', () => {
			assert.equal(utilService.dateParse(null), null);
		});

		it('returns null if undefined', () => {
			assert.equal(utilService.dateParse(undefined), null);
		});

		it('returns null if object', () => {
			assert.equal(utilService.dateParse({ test: 'test' }), null);
		});

		it('returns null if array', () => {
			assert.equal(utilService.dateParse([]), null);
		});

		it('returns null if function', () => {
			assert.equal(utilService.dateParse(emptyFn), null);
		});

		it('returns number if number', () => {
			assert.equal(utilService.dateParse(0), 0);
			assert.equal(utilService.dateParse(12345), 12345);
			assert.equal(utilService.dateParse(-12345), -12345);
		});

		it('returns number if string is a number', () => {
			assert.equal(utilService.dateParse('0'), 0);
			assert.equal(utilService.dateParse('12345'), 12345);
			assert.equal(utilService.dateParse('-12345'), -12345);
		});

		it('returns null if string is bad', () => {
			assert.equal(utilService.dateParse('2017-0000000000000'), null);
			assert.equal(utilService.dateParse('Hello'), null);
		});

		it('returns number if string is a date', () => {
			assert.equal(utilService.dateParse('1970-01-01'), 0);
			assert.equal(utilService.dateParse('1970-01-01T00:00:00.000Z'), 0);
			assert.equal(
				utilService.dateParse('2017-06-19T20:41:45.000Z'),
				1497904905000
			);
		});

		it('returns number if date', () => {
			assert.equal(utilService.dateParse(new Date(0)), 0);
			assert.equal(utilService.dateParse(new Date(12345)), 12345);
			const now = new Date();
			assert.equal(utilService.dateParse(now), now.getTime());
		});
	});

	describe('getPage:', () => {
		[
			{
				input: null,
				expected: 0,
				name: 'should handle null values with default 0'
			},
			{
				input: { limit: 50 },
				expected: 0,
				name: 'should handle empty values with default 0'
			},
			{
				input: { page: -5 },
				expected: 0,
				name: 'should return 0 for negative values'
			},
			{
				input: { page: 1 },
				expected: 1,
				name: 'should return value for positive input'
			},
			{
				input: { page: 10000000 },
				expected: 10000000,
				name: 'should return large, positive input'
			}
		].forEach((test) => {
			it(test.name, () => {
				const actual = utilService.getPage(test.input);
				assert.equal(actual, test.expected);
			});
		});
	});

	describe('getLimit:', () => {
		const defaultLimit = 20,
			defaultMax = 100;

		[
			{
				inputQueryParams: null,
				expected: defaultLimit,
				name: 'should handle null values with default'
			},
			{
				inputQueryParams: {},
				expected: defaultLimit,
				name: 'should handle empty values with default'
			},
			{
				inputQueryParams: { size: -5 },
				expected: 1,
				name: 'should return 1 for negative values'
			},
			{
				inputQueryParams: { size: 0 },
				expected: 1,
				name: 'should return 1 for zero values'
			},
			{
				inputQueryParams: { size: 5 },
				expected: 5,
				name: 'should return value for positive input'
			},
			{
				inputQueryParams: { size: 10000000 },
				expected: defaultMax,
				name: 'should cap limit to default max'
			},
			{
				inputQueryParams: { size: 10000000 },
				inputMaxSize: 50,
				expected: 50,
				name: 'should cap limit to input max'
			}
		].forEach((test) => {
			it(test.name, () => {
				const actual = utilService.getLimit(
					test.inputQueryParams,
					test.inputMaxSize
				);
				assert.equal(actual, test.expected);
			});
		});
	});

	describe('getSort:', () => {
		[
			{
				input: null,
				expected: null,
				name: 'should return null for null params '
			},
			{
				input: {},
				expected: null,
				name: 'should return null for empty params'
			}
		].forEach((test) => {
			it(test.name, () => {
				const actual = utilService.getSort(test.input);
				assert.equal(actual, test.expected);
			});
		});

		[
			{
				input: { sort: 'field1', dir: 'DESC' },
				expected: [{ property: 'field1', direction: 'DESC' }],
				name: 'should create sort array from request parameters'
			},
			{
				input: { sort: 'field1' },
				expected: [{ property: 'field1', direction: 'ASC' }],
				name: 'should use default sort'
			},
			{
				input: { sort: 'field1' },
				defaultDir: 'DESC',
				expected: [{ property: 'field1', direction: 'DESC' }],
				name: 'should use override default dir'
			},
			{
				input: {},
				defaultSort: 'field1',
				expected: [{ property: 'field1', direction: 'ASC' }],
				name: 'should use override default sort'
			},
			{
				input: {},
				defaultDir: 'DESC',
				defaultSort: 'field1',
				expected: [{ property: 'field1', direction: 'DESC' }],
				name: 'should use override default sort and dir'
			}
		].forEach((test) => {
			it(test.name, () => {
				const actual = utilService.getSort(
					test.input,
					test.defaultDir,
					test.defaultSort
				);
				assert.deepStrictEqual(actual, test.expected);
			});
		});
	});

	describe('getSortObj:', () => {
		[
			{
				input: null,
				expected: null,
				name: 'should return null for null params '
			},
			{
				input: {},
				expected: null,
				name: 'should return null for empty params'
			}
		].forEach((test) => {
			it(test.name, () => {
				const actual = utilService.getSortObj(test.input);
				assert.equal(actual, test.expected);
			});
		});

		[
			{
				input: { sort: 'field1', dir: 'DESC' },
				expected: { field1: -1 },
				name: 'should create sort array from request parameters'
			},
			{
				input: { sort: 'field1' },
				expected: { field1: 1 },
				name: 'should use default sort'
			},
			{
				input: { sort: 'field1' },
				defaultDir: 'DESC',
				expected: { field1: -1 },
				name: 'should use override default dir'
			},
			{
				input: {},
				defaultSort: 'field1',
				expected: { field1: 1 },
				name: 'should use override default sort'
			},
			{
				input: {},
				defaultDir: 'DESC',
				defaultSort: 'field1',
				expected: { field1: -1 },
				name: 'should use override default sort and dir'
			},
			{
				input: {},
				defaultDir: 'invalid',
				defaultSort: 'field1',
				expected: { field1: -1 },
				name: 'should default to DESC sort for invalid dir value'
			}
		].forEach((test) => {
			it(test.name, () => {
				const actual = utilService.getSortObj(
					test.input,
					// eslint-disable-next-line @typescript-eslint/ban-ts-comment
					// @ts-ignore
					test.defaultDir,
					test.defaultSort
				);
				assert.deepStrictEqual(actual, test.expected);
			});
		});
	});

	describe('validateNonEmpty:', () => {
		[
			{ input: null, expected: false, name: 'should return false for null' },
			{
				input: undefined,
				expected: false,
				name: 'should return false for undefined'
			},
			{
				input: '',
				expected: false,
				name: 'should return false for empty string'
			},
			{ input: 'Hello', expected: true, name: 'should return true for string' }
		].forEach((test) => {
			it(test.name, () => {
				const actual = utilService.validateNonEmpty(test.input);
				assert.equal(actual, test.expected);
			});
		});
	});

	describe('removeStringsEndingWithWildcard:', () => {
		[
			{
				input: null,
				name: 'should handle null input with default',
				expected: {
					input: null,
					output: []
				}
			},
			{
				input: ['foo'],
				name: 'should leave original list as is and return empty list if no strings ending in wildcard',
				expected: {
					input: ['foo'],
					output: []
				}
			},
			{
				input: ['foo*', 'bar'],
				name: 'should remove strings ending with wildcard from input and add them to output list',
				expected: {
					input: ['bar'],
					output: ['foo*']
				}
			}
		].forEach((test) => {
			it(test.name, () => {
				const actual = utilService.removeStringsEndingWithWildcard(test.input);
				assert.deepStrictEqual(test.input, test.expected.input);
				assert.deepStrictEqual(actual, test.expected.output);
			});
		});
	});

	describe('escapeRegex:', () => {
		const tests = [
			{
				input: 'abcdef',
				expected: 'abcdef',
				description: 'Nothing to escape'
			},
			{
				input: '.?*+^$[]\\(){}|-',
				expected: '\\.\\?\\*\\+\\^\\$\\[\\]\\\\\\(\\)\\{\\}\\|\\-',
				description: 'All of the characters to escape'
			}
		];

		tests.forEach((test) => {
			it(test.description, () => {
				const result = utilService.escapeRegex(test.input);
				assert.equal(result, test.expected);
			});
		});
	});
});
