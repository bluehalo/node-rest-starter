const should = require('should'),
	helpers = require('./helpers');

describe('helpers', () => {
	describe('parsedJSON', () => {
		it('returns null if null', () => {
			should(helpers.parsedJSON(null)).be.null();
		});

		it('returns undefined if null', () => {
			should(helpers.parsedJSON(undefined)).be.undefined();
		});

		it('throws if json is circular', () => {
			const obj = { a: 'a' };
			obj.obj = obj;
			should(() => {
				helpers.parsedJSON(obj);
			}).throwError();

			it('returns equivalent object', () => {
				const obj = { a: 'a', obj: { aa: 'aa' }, date: new Date(), one: 1 };
				should(helpers.parsedJSON(obj)).deepEqual(obj);
			});
		});
	});

	describe('isISOString', () => {
		it('is false for null', () => {
			should(helpers.isISOString(null)).be.false();
		});

		it('is false for undefined', () => {
			should(helpers.isISOString(undefined)).be.false();
		});

		it('is false for random string', () => {
			should(helpers.isISOString('random')).be.false();
		});

		it('is false for number', () => {
			should(helpers.isISOString(1663186348452)).be.false();
		});

		it('is false for object', () => {
			should(helpers.isISOString({})).be.false();
		});

		it('is true for iso string', () => {
			should(helpers.isISOString('2022-09-14T20:12:53.671Z')).be.true();
		});
	});
});
