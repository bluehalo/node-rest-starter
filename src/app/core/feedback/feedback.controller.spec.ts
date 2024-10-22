import { assert, createSandbox } from 'sinon';

import * as feedbackController from './feedback.controller';
import { Feedback } from './feedback.model';
import feedbackService from './feedback.service';
import { auditService } from '../../../dependencies';
import { getResponseSpy } from '../../../spec/helpers';
import { User } from '../user/user.model';

describe('Feedback Controller2', () => {
	let res;
	let sandbox;

	beforeEach(() => {
		sandbox = createSandbox();
		res = getResponseSpy();
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('submitFeedback', () => {
		it(`should submit feedback successfully`, async () => {
			const req = {
				body: {
					body: 'This is a test',
					type: 'Bug',
					url: 'http://localhost:3000/some-page?with=param'
				},
				user: new User({})
			};

			sandbox.stub(auditService, 'audit').resolves({ audit: {} });
			sandbox.stub(feedbackService, 'create').resolves(new Feedback());
			sandbox.stub(feedbackService, 'sendFeedbackEmail').resolves();

			await feedbackController.submitFeedback(req, res);

			assert.calledOnce(feedbackService.create);
			assert.calledOnce(auditService.audit);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('searchFeedback', () => {
		it('search returns feedback', async () => {
			const req = { body: {} };

			sandbox.stub(feedbackService, 'search').resolves();
			await feedbackController.search(req, res);

			assert.calledOnce(feedbackService.search);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('updateFeedbackAssignee', () => {
		it('assignee is updated', async () => {
			const req = { body: { assignee: 'user' } };

			sandbox.stub(feedbackService, 'updateFeedbackAssignee').resolves();
			await feedbackController.updateFeedbackAssignee(req, res);

			assert.calledOnceWithExactly(
				feedbackService.updateFeedbackAssignee,
				undefined,
				req.body.assignee
			);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('updateFeedbackStatus', () => {
		it('status is updated', async () => {
			const req = { body: { status: 'closed' } };

			sandbox.stub(feedbackService, 'updateFeedbackStatus').resolves();
			await feedbackController.updateFeedbackStatus(req, res);

			assert.calledOnceWithExactly(
				feedbackService.updateFeedbackStatus,
				undefined,
				req.body.status
			);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});
});
