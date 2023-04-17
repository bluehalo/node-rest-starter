import should from 'should';

import { parsedJSON, isISOString } from './helpers';

describe('helpers', () => {
	describe('parsedJSON', () => {
		it('returns null if null', () => {
			should(parsedJSON(null)).be.null();
		});

		it('returns undefined if null', () => {
			should(parsedJSON(undefined)).be.undefined();
		});

		it('throws if json is circular', () => {
			const obj: Record<string, unknown> = { a: 'a' };
			obj.obj = obj;
			should(() => {
				parsedJSON(obj);
			}).throwError();

			it('returns equivalent object', () => {
				const obj = { a: 'a', obj: { aa: 'aa' }, date: new Date(), one: 1 };
				should(parsedJSON(obj)).deepEqual(obj);
			});
		});
	});

	describe('isISOString', () => {
		it('is false for null', () => {
			should(isISOString(null)).be.false();
		});

		it('is false for undefined', () => {
			should(isISOString(undefined)).be.false();
		});

		it('is false for random string', () => {
			should(isISOString('random')).be.false();
		});

		it('is false for number', () => {
			should(isISOString(1663186348452)).be.false();
		});

		it('is false for object', () => {
			should(isISOString({})).be.false();
		});

		it('is true for iso string', () => {
			should(isISOString('2022-09-14T20:12:53.671Z')).be.true();
		});
	});
});
