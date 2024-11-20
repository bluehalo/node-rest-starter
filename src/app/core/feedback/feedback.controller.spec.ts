import assert from 'node:assert/strict';

import { FastifyInstance } from 'fastify';
import { assert as sinonAssert, createSandbox } from 'sinon';

import feedbackController from './feedback.controller';
import { Feedback } from './feedback.model';
import feedbackService from './feedback.service';
import { auditService } from '../../../dependencies';
import { fastifyTest } from '../../../spec/fastify';

describe('Feedback Controller', () => {
	let sandbox;

	let app: FastifyInstance;

	before(() => {
		app = fastifyTest(feedbackController, {
			logger: { level: 'debug' },
			user: {
				roles: {
					user: true,
					admin: true
				}
			}
		});
	});
	after(() => {
		app.close();
	});

	beforeEach(() => {
		sandbox = createSandbox();
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('submitFeedback', () => {
		it(`should submit feedback successfully`, async () => {
			sandbox.stub(auditService, 'audit').resolves({ audit: {} });
			sandbox.stub(feedbackService, 'create').resolves(new Feedback());
			sandbox.stub(feedbackService, 'sendFeedbackEmail').resolves();

			const reply = await app.inject({
				method: 'POST',
				url: '/feedback',
				payload: {
					body: 'This is a test',
					type: 'Bug',
					url: 'http://localhost:3000/some-page?with=param'
				}
			});

			sinonAssert.calledOnce(feedbackService.create);
			sinonAssert.calledOnce(auditService.audit);

			assert.equal(reply.statusCode, 200);
			assert(reply.body);
		});

		describe('searchFeedback', () => {
			it('search returns feedback', async () => {
				sandbox.stub(feedbackService, 'search').resolves({});

				const reply = await app.inject({
					method: 'POST',
					url: '/admin/feedback',
					payload: {}
				});

				sinonAssert.calledOnce(feedbackService.search);

				assert.equal(reply.statusCode, 200);
				assert(reply.body);
			});
		});

		describe('updateFeedbackAssignee', () => {
			it('assignee is updated', async () => {
				sandbox.stub(feedbackService, 'read').resolves({});
				sandbox.stub(feedbackService, 'updateFeedbackAssignee').resolves({});

				const reply = await app.inject({
					method: 'PATCH',
					url: '/admin/feedback/1/assignee',
					payload: { assignee: 'user' }
				});

				sinonAssert.calledOnceWithExactly(
					feedbackService.updateFeedbackAssignee,
					{},
					'user'
				);

				assert.equal(reply.statusCode, 200);
				assert(reply.body);
			});
		});

		describe('updateFeedbackStatus', () => {
			it('status is updated', async () => {
				sandbox.stub(feedbackService, 'read').resolves({});
				sandbox.stub(feedbackService, 'updateFeedbackStatus').resolves({});

				const reply = await app.inject({
					method: 'PATCH',
					url: '/admin/feedback/1/status',
					payload: { status: 'Closed' }
				});

				sinonAssert.calledOnceWithExactly(
					feedbackService.updateFeedbackStatus,
					{},
					'Closed'
				);

				assert.equal(reply.statusCode, 200);
				assert(reply.body);
			});
		});
	});
});
