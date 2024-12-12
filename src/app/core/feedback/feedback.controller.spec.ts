import assert from 'node:assert/strict';

import { FastifyInstance } from 'fastify';
import {
	assert as sinonAssert,
	createSandbox,
	SinonSpy,
	SinonSandbox
} from 'sinon';

import controller from './feedback.controller';
import { Feedback } from './feedback.model';
import feedbackService from './feedback.service';
import { auditService } from '../../../dependencies';
import { fastifyTest } from '../../../spec/fastify';
import { User, UserDocument } from '../user/user.model';

describe('Feedback Controller', () => {
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

	describe('submitFeedback', () => {
		it(`should submit feedback successfully`, async () => {
			sandbox.stub(auditService, 'audit').resolves();
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

			sinonAssert.calledOnce(auditService.audit as SinonSpy);

			assert.equal(
				reply.statusCode,
				200,
				`route rejected with "${reply.payload}"`
			);
			assert(reply.body);
		});
	});
});
