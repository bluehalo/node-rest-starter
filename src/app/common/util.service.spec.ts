import should from 'should';

import { config, utilService } from '../../dependencies';

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
					when: [{}, { something: 0 }, { $date: '2015-01-01T00:00:00.000Z' }]
				},
				date: { $date: '2015-07-01T00:00:00.000Z' }
			};

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const output = utilService.toMongoose(input) as any;
			output.hello.should.be.a.Object();
			output.hello.there.should.equal('you are');
			output.hello.when.should.be.a.Array();
			output.hello.when.length.should.equal(3);
			output.hello.when[0].should.be.a.Object();
			output.hello.when[1].something.should.equal(0);
			output.hello.when[2].getTime().should.equal(1420070400000);
			output.date.getTime().should.equal(1435708800000);
		});

		it('should convert $obj : {""} to new mongoose.Types.ObjectId("")', () => {
			const input = {
				hello: {
					there: 'you are',
					when: [{}, { something: 0 }, { $obj: '000000000000000000000000' }]
				},
				obj: { $obj: '000000000000000000000001' }
			};

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const output = utilService.toMongoose(input) as any;
			output.hello.should.be.a.Object();
			output.hello.there.should.equal('you are');
			output.hello.when.should.be.a.Array();
			output.hello.when.length.should.equal(3);
			output.hello.when[0].should.be.a.Object();
			output.hello.when[1].something.should.equal(0);
			output.hello.when[2]._bsontype.should.equal('ObjectID');
			output.hello.when[2]
				.toHexString()
				.should.equal('000000000000000000000000');
			output.obj._bsontype.should.equal('ObjectID');
			output.obj.toHexString().should.equal('000000000000000000000001');
		});
	});

	describe('Date Parse:', () => {
		it('returns null if null', () => {
			should.equal(utilService.dateParse(null), null);
		});

		it('returns null if undefined', () => {
			should.equal(utilService.dateParse(undefined), null);
		});

		it('returns null if object', () => {
			should.equal(utilService.dateParse({ test: 'test' }), null);
		});

		it('returns null if array', () => {
			should.equal(utilService.dateParse([]), null);
		});

		it('returns null if function', () => {
			should.equal(utilService.dateParse(emptyFn), null);
		});

		it('returns number if number', () => {
			should.equal(utilService.dateParse(0), 0);
			should.equal(utilService.dateParse(12345), 12345);
			should.equal(utilService.dateParse(-12345), -12345);
		});

		it('returns number if string is a number', () => {
			should.equal(utilService.dateParse('0'), 0);
			should.equal(utilService.dateParse('12345'), 12345);
			should.equal(utilService.dateParse('-12345'), -12345);
		});

		it('returns null if string is bad', () => {
			should.equal(utilService.dateParse('2017-0000000000000'), null);
			should.equal(utilService.dateParse('Hello'), null);
		});

		it('returns number if string is a date', () => {
			should.equal(utilService.dateParse('1970-01-01'), 0);
			should.equal(utilService.dateParse('1970-01-01T00:00:00.000Z'), 0);
			should.equal(
				utilService.dateParse('2017-06-19T20:41:45.000Z'),
				1497904905000
			);
		});

		it('returns number if date', () => {
			should.equal(utilService.dateParse(new Date(0)), 0);
			should.equal(utilService.dateParse(new Date(12345)), 12345);
			const now = new Date();
			should.equal(utilService.dateParse(now), now.getTime());
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
				input: 6,
				expected: 0,
				name: 'should handle number inputs with default 0'
			},
			{
				input: 'test',
				expected: 0,
				name: 'should handle string inputs with default 0'
			},
			{
				input: true,
				expected: 0,
				name: 'should handle boolean inputs with default 0'
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
				input: { page: 'first' },
				expected: 0,
				name: 'should return default value 0 for string'
			},
			{
				input: { page: 10000000 },
				expected: 10000000,
				name: 'should return large, positive input'
			}
		].forEach((test) => {
			it(test.name, () => {
				const actual = utilService.getPage(test.input);
				should(actual).equal(test.expected);
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
				inputQueryParams: { size: 'twenty' },
				expected: defaultLimit,
				name: 'should return default for string'
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
				should(actual).equal(test.expected);
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
				should(actual).equal(test.expected);
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
				should.exist(actual);
				actual.should.be.Array();
				test.expected.forEach((item, index) => {
					item.property.should.equal(actual[index].property);
					item.direction.should.equal(actual[index].direction);
				});
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
				should(actual).equal(test.expected);
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
				should.exist(actual);
				actual.should.containEql(test.expected);
			});
		});
	});

	describe('contains:', () => {
		[
			{
				inputArray: [1, 2, 3],
				inputElement: 2,
				expected: true,
				name: 'should return true for number in array'
			},
			{
				inputArray: [{ id: 1 }, { id: 2 }, { id: 3 }],
				inputElement: { id: 2 },
				expected: true,
				name: 'should return true for object with same values'
			},
			{
				inputArray: [{ id: 1 }, { id: 2 }, { id: 3 }],
				inputElement: { id: 2, name: 'Test' },
				expected: false,
				name: 'should return false for object with additional attributes'
			},
			{
				inputArray: [false, false, false],
				inputElement: false,
				expected: true,
				name: 'should return true for boolean in array'
			},
			{
				inputArray: [true, false],
				inputElement: true,
				expected: true,
				name: 'should return true for boolean in array'
			},
			{
				inputArray: [true, true],
				inputElement: false,
				expected: false,
				name: 'should return false for boolean not in array'
			},
			{
				inputArray: ['test', 'it', { id: 3 }],
				inputElement: 'it',
				expected: true,
				name: 'should return true for string in array'
			},
			{
				inputArray: ['testing', 'it out', 45, false, { id: 5 }],
				inputElement: true,
				expected: false,
				name: 'should return false for boolean not in array'
			}
		].forEach((test) => {
			it(test.name, () => {
				const actual = utilService.contains(test.inputArray, test.inputElement);
				should(actual).equal(test.expected);
			});
		});
	});

	describe('validateNumber:', () => {
		[
			{ input: null, expected: false, name: 'should return false for null' },
			{
				input: undefined,
				expected: false,
				name: 'should return false for undefined'
			},
			{
				input: emptyFn,
				expected: false,
				name: 'should return false for function'
			},
			{ input: {}, expected: false, name: 'should return false for object' },
			{ input: [], expected: false, name: 'should return false for array' },
			{ input: '', expected: false, name: 'should return false for string' },
			{
				input: '456456',
				expected: false,
				name: 'should return false for number string'
			},
			{ input: 1, expected: true, name: 'should return true for number' }
		].forEach((test) => {
			it(test.name, () => {
				const actual = utilService.validateNumber(test.input);
				should(actual).equal(test.expected);
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
				input: emptyFn,
				expected: false,
				name: 'should return false for function'
			},
			{ input: {}, expected: false, name: 'should return false for object' },
			{
				input: [],
				expected: false,
				name: 'should return false for empty array'
			},
			{
				input: '',
				expected: false,
				name: 'should return false for empty string'
			},
			{ input: 'Hello', expected: true, name: 'should return true for string' },
			{ input: 1, expected: false, name: 'should return false for number' }
		].forEach((test) => {
			it(test.name, () => {
				const actual = utilService.validateNonEmpty(test.input);
				should(actual).equal(test.expected);
			});
		});
	});

	describe('validateArray:', () => {
		[
			{ input: null, expected: false, name: 'should return false for null' },
			{
				input: undefined,
				expected: false,
				name: 'should return false for undefined'
			},
			{
				input: emptyFn,
				expected: false,
				name: 'should return false for function'
			},
			{ input: {}, expected: false, name: 'should return false for object' },
			{
				input: [],
				expected: false,
				name: 'should return false for empty array'
			},
			{
				input: [1, 2, 3],
				expected: true,
				name: 'should return true for number array'
			},
			{
				input: ['Hello', 'You'],
				expected: true,
				name: 'should return true for string array'
			},
			{
				input: ['Hello', 2, 3],
				expected: true,
				name: 'should return true for mixed array'
			},
			{
				input: '',
				expected: false,
				name: 'should return false for empty string'
			},
			{
				input: 'Hello',
				expected: false,
				name: 'should return false for string'
			},
			{ input: 1, expected: false, name: 'should return false for number' }
		].forEach((test) => {
			it(test.name, () => {
				const actual = utilService.validateArray(test.input);
				should(actual).equal(test.expected);
			});
		});
	});

	describe('getClientErrorMessage:', () => {
		let originalExposeServerErrors;

		before(() => {
			originalExposeServerErrors = config.exposeServerErrors;
		});

		after(() => {
			// Restore the original exposeServerErrors config
			config.exposeServerErrors = originalExposeServerErrors;
		});

		const defaultResponse = 'A server error has occurred.';
		const unknownError = 'unknown error';

		const errorTests = [
			{
				testName: 'null error',
				error: null,
				expected: unknownError
			},
			{
				testName: 'string error',
				error: 'This is an error',
				expected: 'This is an error'
			},
			{
				testName: 'empty string error',
				error: '',
				expected: ''
			},
			{
				testName: 'empty object error',
				error: {},
				expected: 'unknown error'
			},
			{
				testName: 'message object error',
				error: { message: 'Message Error' },
				expected: 'Message Error'
			},
			{
				testName: 'message and stack object error',
				error: { message: 'Message Error', stack: 'this is\na stack' },
				expected: '[Message Error] this is\na stack'
			},
			{
				testName: 'stack object error',
				error: { stack: 'this is\na stack' },
				expected: `[${unknownError}] this is\na stack`
			}
		];

		errorTests.forEach((test) => {
			it(`should return default error message when config is false: ${test.testName}`, () => {
				config.exposeServerErrors = false;
				const actual = utilService.getClientErrorMessage(test.error);
				should(actual).equal(defaultResponse);
			});
		});

		errorTests.forEach((test) => {
			it(`should return contextual error message when config is true: ${test.testName}`, () => {
				config.exposeServerErrors = true;
				const actual = utilService.getClientErrorMessage(test.error);
				should(actual).equal(test.expected);
			});
		});
	});

	describe('getPagingResults:', () => {
		[
			{
				expected: {
					pageSize: 20,
					pageNumber: 0,
					totalSize: 0,
					totalPages: 0,
					elements: []
				},
				name: 'should handle undefined values with defaults'
			},
			{
				pageSize: 10,
				pageNumber: 10,
				totalSize: 0,
				elements: [],
				expected: {
					pageSize: 10,
					pageNumber: 0,
					totalSize: 0,
					totalPages: 0,
					elements: []
				},
				name: 'should set pageNumber to 0 if totalSize is 0'
			},
			{
				pageSize: 10,
				pageNumber: 10,
				totalSize: 42,
				elements: [1, 2],
				expected: {
					pageSize: 10,
					pageNumber: 10,
					totalSize: 42,
					totalPages: 5,
					elements: [1, 2]
				},
				name: 'should correctly calculate totalPages'
			}
		].forEach((test) => {
			it(test.name, () => {
				const actual = utilService.getPagingResults(
					test.pageSize,
					test.pageNumber,
					test.totalSize,
					test.elements
				);
				Object.keys(actual).forEach((key) => {
					if (key === 'elements') {
						should(actual[key]).containDeep(test.expected[key]);
					} else {
						should(actual[key]).equal(test.expected[key]);
					}
				});
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
				should(test.input).containDeep(test.expected.input);
				should(actual).containDeep(test.expected.output);
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
				should(result).equal(test.expected);
			});
		});
	});
});
