import assert from 'node:assert/strict';

import { FastifyInstance } from 'fastify';
import {
	assert as sinonAssert,
	createSandbox,
	SinonSandbox,
	SinonSpy
} from 'sinon';

import controller from './feedback-admin.controller';
import { Feedback, FeedbackDocument } from './feedback.model';
import feedbackService from './feedback.service';
import { fastifyTest } from '../../../spec/fastify';
import { PagingResults } from '../../common/mongoose/paginate.plugin';
import { User, UserDocument } from '../user/user.model';

describe('Feedback Admin Controller', () => {
	let sandbox: SinonSandbox;

	let app: FastifyInstance;
	let user: UserDocument;

	before(async () => {
		await User.deleteMany({});
		user = await new User({
			name: 'Test User',
			username: 'test',
			email: 'test@test.test',
			organization: 'test',
			provider: 'test',
			roles: {
				user: true,
				admin: true
			}
		}).save();
		app = fastifyTest(controller, {
			// logger: { level: 'debug' },
			user
		});
	});
	after(async () => {
		await app.close();
		await User.deleteMany({});
	});

	beforeEach(async () => {
		sandbox = createSandbox();
		await Feedback.deleteMany({});
	});

	afterEach(async () => {
		sandbox.restore();
		await Feedback.deleteMany({});
	});

	describe('searchFeedback', () => {
		it('search returns feedback', async () => {
			sandbox
				.stub(feedbackService, 'search')
				.resolves({} as PagingResults<FeedbackDocument>);

			const reply = await app.inject({
				method: 'POST',
				url: '/admin/feedback',
				payload: {
					q: {},
					s: ''
				}
			});

			sinonAssert.calledOnce(feedbackService.search as SinonSpy);

			assert.equal(
				reply.statusCode,
				200,
				`route rejected with "${reply.payload}"`
			);
			assert(reply.body);
		});
	});

	describe('updateFeedbackAssignee', () => {
		it('assignee is updated', async () => {
			const feedback = new Feedback({
				body: 'This is a test',
				type: 'Bug',
				url: 'http://localhost:3000/some-page?with=param',
				creator: user._id
			});
			await feedback.save();

			const reply = await app.inject({
				method: 'PATCH',
				url: `/admin/feedback/${feedback._id}/assignee`,
				payload: { assignee: 'user' }
			});

			assert.equal(
				reply.statusCode,
				200,
				`route rejected with "${reply.payload}"`
			);
			assert.equal(reply.json().assignee, 'user');
			assert(reply.body);
		});
	});

	describe('updateFeedbackStatus', () => {
		it('status is updated', async () => {
			const feedback = new Feedback({
				body: 'This is a test',
				type: 'Bug',
				url: 'http://localhost:3000/some-page?with=param',
				creator: user._id
			});
			await feedback.save();

			const reply = await app.inject({
				method: 'PATCH',
				url: `/admin/feedback/${feedback._id}/status`,
				payload: { status: 'Closed' }
			});

			assert.equal(
				reply.statusCode,
				200,
				`route rejected with "${reply.payload}"`
			);
			assert.equal(reply.json().status, 'Closed');
			assert(reply.body);
		});
	});
});
