import assert from 'node:assert/strict';

import { Audit } from './audit.model';
import auditService from './audit.service';
import { IUser } from '../user/user.model';

/**
 * Globals
 */
function clearDatabase() {
	return Audit.deleteMany({}).exec();
}

/**
 * Unit tests
 */
describe('Audit Service:', () => {
	let startTimestamp: number;
	before(async () => {
		await clearDatabase();
		const now = Date.now();
		startTimestamp = now - (now % 1000); // remove milliseconds
	});

	after(() => {
		return clearDatabase();
	});

	describe('Create new Audit entry', () => {
		it('should begin with no audits', async () => {
			const results = await Audit.find({}).exec();
			assert.deepStrictEqual(results, []);
		});

		it('should be able to create a new audit through the service', () => {
			return auditService.audit(
				'some message',
				'eventType',
				'eventAction',
				{ name: 'eventActor', username: 'eventActor' } as IUser,
				'eventObject'
			);
		});

		it('should have one audit entry', async () => {
			const results = await Audit.find({}).exec();
			assert(Array.isArray(results), 'results should be an Array');
			assert.equal(results.length, 1);

			const { created, _id, ...result } = results[0].toObject({
				versionKey: false
			});
			/*
			 * Audit's created date should be after the unit tests started,
			 * but may be the same time since ISO Date strips off the milliseconds,
			 * so we'll remove 1 from the zero'ed milliseconds of the startTimestamp
			 */
			assert(
				created.getTime() > startTimestamp - 1,
				'created date should be after the test started'
			);

			assert.deepStrictEqual(result, {
				id: _id.toString(),
				message: 'some message',
				audit: {
					auditType: 'eventType',
					action: 'eventAction',
					actor: {
						name: 'eventActor',
						username: 'eventActor'
					},
					object: 'eventObject'
				}
			});
		});

		it('should have one distinct action', async () => {
			const results = await Audit.distinct('audit.action', {}).exec();
			assert.deepStrictEqual(results, ['eventAction']);
		});
	});
});
