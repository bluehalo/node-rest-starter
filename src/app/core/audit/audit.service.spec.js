'use strict';

const should = require('should'),
	{ dbs } = require('../../../dependencies'),
	Audit = dbs.admin.model('Audit'),
	auditService = require('./audit.service');

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
	let startTimestamp;
	before(() => {
		return clearDatabase().then(() => {
			const now = Date.now();
			startTimestamp = now - (now % 1000); // remove milliseconds
		});
	});

	after(() => {
		return clearDatabase();
	});

	describe('Create new Audit entry', () => {
		it('should begin with no audits', () => {
			return Audit.find({})
				.exec()
				.then((results) => {
					should(results).be.an.Array();
					should(results).have.length(0);
				});
		});

		it('should be able to create a new audit through the service', () => {
			return auditService.audit(
				'some message',
				'eventType',
				'eventAction',
				{ name: 'eventActor', username: 'eventActor' },
				'eventObject'
			);
		});

		it('should have one audit entry', () => {
			return Audit.find({})
				.exec()
				.then((results) => {
					should(results).be.an.Array();
					should(results).have.length(1);

					/*
					 * Audit's created date should be after the unit tests started,
					 * but may be the same time since ISO Date strips off the milliseconds,
					 * so we'll remove 1 from the zero'ed milliseconds of the startTimestamp
					 */
					should(results[0].created).be.above(startTimestamp - 1);
					should(results[0].message).equal('some message');
					should(results[0].audit.auditType).equal('eventType');
					should(results[0].audit.action).equal('eventAction');
					should(results[0].audit.actor).eql({
						name: 'eventActor',
						username: 'eventActor'
					});
					should(results[0].audit.object).equal('eventObject');
				});
		});

		it('should have one distinct action', () => {
			return Audit.distinct('audit.action', {})
				.exec()
				.then((results) => {
					should(results).be.an.Array();
					should(results.length).equal(1);
					should(results).containDeep(['eventAction']);
				});
		});
	});
});
