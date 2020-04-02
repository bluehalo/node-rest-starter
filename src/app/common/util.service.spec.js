'use strict';

const
	should = require('should'),

	deps = require('../../dependencies'),
	util = deps.utilService;


/**
 * Globals
 */


/**
 * Unit tests
 */
describe('Utils:', () => {

	describe('toMongoose:', () => {

		it('should convert $date : {""} to new Date("")', () => {
			const input = {hello: {there: 'you are', when: [{},{something:0},{$date:'2015-01-01T00:00:00.000Z'}]}, date: {$date:'2015-07-01T00:00:00.000Z'}};

			const output = util.toMongoose(input);
			(typeof output.hello).should.equal('object');
			output.hello.there.should.equal('you are');
			Array.isArray(output.hello.when).should.equal(true);
			output.hello.when.length.should.equal(3);
			(typeof output.hello.when[0]).should.equal('object');
			(output.hello.when[0].length == null).should.equal(true);
			output.hello.when[1].something.should.equal(0);
			output.hello.when[2].getTime().should.equal(1420070400000);
			output.date.getTime().should.equal(1435708800000);
		});

		it('should convert $obj : {""} to mongoose.Types.ObjectId("")', () => {
			const input = {hello: {there: 'you are', when: [{},{something:0},{$obj:'000000000000000000000000'}]}, obj: {$obj:'000000000000000000000001'}};

			const output = util.toMongoose(input);
			(typeof output.hello).should.equal('object');
			output.hello.there.should.equal('you are');
			Array.isArray(output.hello.when).should.equal(true);
			output.hello.when.length.should.equal(3);
			(typeof output.hello.when[0]).should.equal('object');
			(output.hello.when[0].length == null).should.equal(true);
			output.hello.when[1].something.should.equal(0);
			output.hello.when[2]._bsontype.should.equal('ObjectID');
			output.hello.when[2].toHexString().should.equal('000000000000000000000000');
			output.obj._bsontype.should.equal('ObjectID');
			output.obj.toHexString().should.equal('000000000000000000000001');
		});

	});

	describe('Date Parse:', () => {

		it('returns null if null', () => {
			should.equal(util.dateParse(null), null);
		});

		it('returns null if undefined', () => {
			should.equal(util.dateParse(undefined), null);
		});

		it('returns null if object', () => {
			should.equal(util.dateParse({}), null);
		});

		it('returns null if array', () => {
			should.equal(util.dateParse([]), null);
		});

		it('returns null if function', () => {
			should.equal(util.dateParse(() => {}), null);
		});

		it('returns number if number', () => {
			should.equal(util.dateParse(0), 0);
			should.equal(util.dateParse(12345), 12345);
			should.equal(util.dateParse(-12345), -12345);
		});

		it('returns number if string is a number', () => {
			should.equal(util.dateParse('0'), 0);
			should.equal(util.dateParse('12345'), 12345);
			should.equal(util.dateParse('-12345'), -12345);
		});

		it('returns null if string is bad', () => {
			should.equal(util.dateParse('2017-0000000000000'), null);
			should.equal(util.dateParse('Hello'), null);
		});

		it('returns number if string is a date', () => {
			should.equal(util.dateParse('1970-01-01'), 0);
			should.equal(util.dateParse('1970-01-01T00:00:00.000Z'), 0);
			should.equal(util.dateParse('2017-06-19T20:41:45.000Z'), 1497904905000);
		});

		it('returns number if date', () => {
			should.equal(util.dateParse(new Date(0)), 0);
			should.equal(util.dateParse(new Date(12345)), 12345);
			const now = new Date();
			should.equal(util.dateParse(now), now.getTime());
		});
	});

	describe('getPage:', () => {
		[{
			input: null,
			expected: 0,
			name: 'should handle null values with default 0'
		}, {
			input: 6,
			expected: 0,
			name: 'should handle number inputs with default 0'
		}, {
			input: 'test',
			expected: 0,
			name: 'should handle string inputs with default 0'
		}, {
			input: true,
			expected: 0,
			name: 'should handle boolean inputs with default 0'
		}, {
			input: { limit: 50 },
			expected: 0,
			name: 'should handle empty values with default 0'
		}, {
			input: { page: -5 },
			expected: 0,
			name: 'should return 0 for negative values'
		}, {
			input: { page: 1 },
			expected: 1,
			name: 'should return value for positive input'
		}, {
			input: { page: 'first' },
			expected: 0,
			name: 'should return default value 0 for string'
		}, {
			input: { page: 10000000 },
			expected: 10000000,
			name: 'should return large, positive input'
		}].forEach((test) => {
			it(test.name, () => {
				const actual = util.getPage(test.input);
				should(actual).equal(test.expected);
			});
		});
	});

	describe('getLimit:', () => {

		const defaultLimit = 20, defaultMax = 100;

		[{
			inputQueryParams: null,
			inputMaxSize: null,
			expected: defaultLimit,
			name: 'should handle null values with default'
		}, {
			inputQueryParams: {},
			inputMaxSize: null,
			expected: defaultLimit,
			name: 'should handle empty values with default'
		}, {
			inputQueryParams: { size: -5 },
			inputMaxSize: null,
			expected: 1,
			name: 'should return 1 for negative values'
		}, {
			inputQueryParams: { size: 0 },
			inputMaxSize: null,
			expected: 1,
			name: 'should return 1 for zero values'
		}, {
			inputQueryParams: { size: 5 },
			inputMaxSize: null,
			expected: 5,
			name: 'should return value for positive input'
		}, {
			inputQueryParams: { size: 'twenty' },
			inputMaxSize: null,
			expected: defaultLimit,
			name: 'should return default for string'
		}, {
			inputQueryParams: { size: 10000000 },
			inputMaxSize: null,
			expected: defaultMax,
			name: 'should cap limit to default max'
		}, {
			inputQueryParams: { size: 10000000 },
			inputMaxSize: 50,
			expected: 50,
			name: 'should cap limit to input max'
		}].forEach((test) => {
			it(test.name, () => {
				const actual = util.getLimit(test.inputQueryParams, test.inputMaxSize);
				should(actual).equal(test.expected);
			});
		});
	});

	describe('contains:', () => {
		[{
			inputArray: [1, 2, 3],
			inputElement: 2,
			expected: true,
			name: 'should return true for number in array'
		}, {
			inputArray: [{id:1}, {id:2}, {id:3}],
			inputElement: {id:2},
			expected: true,
			name: 'should return true for object with same values'
		}, {
			inputArray: [{id:1}, {id:2}, {id:3}],
			inputElement: {id:2, name:'Test'},
			expected: false,
			name: 'should return false for object with additional attributes'
		}, {
			inputArray: [false, false, false],
			inputElement: false,
			expected: true,
			name: 'should return true for boolean in array'
		}, {
			inputArray: [true, false],
			inputElement: true,
			expected: true,
			name: 'should return true for boolean in array'
		}, {
			inputArray: [true, true],
			inputElement: false,
			expected: false,
			name: 'should return false for boolean not in array'
		}, {
			inputArray: ['test', 'it', { id: 3 }],
			inputElement: 'it',
			expected: true,
			name: 'should return true for string in array'
		}, {
			inputArray: ['testing', 'it out', 45, false, { id: 5 }],
			inputElement: true,
			expected: false,
			name: 'should return false for boolean not in array'
		}].forEach((test) => {
			it(test.name, () => {
				const actual = util.contains(test.inputArray, test.inputElement);
				should(actual).equal(test.expected);
			});
		});
	});

	describe('validateNumber:', () => {
		[
			{ input: null, 			expected: false, name: 'should return false for null'},
			{ input: undefined, 	expected: false, name: 'should return false for undefined'},
			{ input: (() => {}), 	expected: false, name: 'should return false for function'},
			{ input: {}, 			expected: false, name: 'should return false for object'},
			{ input: [], 			expected: false, name: 'should return false for array'},
			{ input: '', 			expected: false, name: 'should return false for string'},
			{ input: '456456', 		expected: false, name: 'should return false for number string'},
			{ input: 1, 			expected: true, name: 'should return true for number'}
		].forEach((test) => {
			it(test.name, () => {
				const actual = util.validateNumber(test.input);
				should(actual).equal(test.expected);
			});
		});
	});

	describe('validateNonEmpty:', () => {
		[
			{ input: null, 			expected: false, name: 'should return false for null'},
			{ input: undefined, 	expected: false, name: 'should return false for undefined'},
			{ input: (() => {}), 	expected: false, name: 'should return false for function'},
			{ input: {}, 			expected: false, name: 'should return false for object'},
			{ input: [], 			expected: false, name: 'should return false for empty array'},
			{ input: '', 			expected: false, name: 'should return false for empty string'},
			{ input: 'Hello', 		expected: true, name: 'should return true for string'},
			{ input: 1, 			expected: false, name: 'should return false for number'}
		].forEach((test) => {
			it(test.name, () => {
				const actual = util.validateNonEmpty(test.input);
				should(actual).equal(test.expected);
			});
		});
	});

	describe('validateArray:', () => {
		[
			{ input: null, 				expected: false, name: 'should return false for null'},
			{ input: undefined, 		expected: false, name: 'should return false for undefined'},
			{ input: (() => {}), 		expected: false, name: 'should return false for function'},
			{ input: {}, 				expected: false, name: 'should return false for object'},
			{ input: [], 				expected: false, name: 'should return false for empty array'},
			{ input: [1,2,3], 			expected: true, name: 'should return true for number array'},
			{ input: ['Hello','You'],	expected: true, name: 'should return true for string array'},
			{ input: ['Hello',2,3],		expected: true, name: 'should return true for mixed array'},
			{ input: '', 				expected: false, name: 'should return false for empty string'},
			{ input: 'Hello', 			expected: false, name: 'should return false for string'},
			{ input: 1, 				expected: false, name: 'should return false for number'}
		].forEach((test) => {
			it(test.name, () => {
				const actual = util.validateArray(test.input);
				should(actual).equal(test.expected);
			});
		});
	});

	describe('getClientErrorMessage:', () => {

		let originalExposeServerErrors;

		before(() => {
			originalExposeServerErrors = deps.config.exposeServerErrors;
		});

		after(() => {
			// Restore the original exposeServerErrors config
			deps.config.exposeServerErrors = originalExposeServerErrors;
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
				error: { },
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
				deps.config.exposeServerErrors = false;
				const actual = util.getClientErrorMessage(test.error);
				should(actual).equal(defaultResponse);
			});
		});

		errorTests.forEach((test) => {
			it(`should return contextual error message when config is true: ${test.testName}`, () => {
				deps.config.exposeServerErrors = true;
				const actual = util.getClientErrorMessage(test.error);
				should(actual).equal(test.expected);
			});
		});

	});

	describe('getPagingResults:', () => {
		[{
			pageSize: null,
			pageNumber: null,
			totalSize: null,
			elements: null,
			expected: {
				pageSize: 20,
				pageNumber: 0,
				totalSize: 0,
				totalPages: 0,
				elements: []
			},
			name: 'should handle null values with defaults'
		}, {
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
		}, {
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
		}].forEach((test) => {
			it(test.name, () => {
				const actual = util.getPagingResults(test.pageSize, test.pageNumber, test.totalSize, test.elements);
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
});
