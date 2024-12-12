import assert from 'node:assert/strict';

import { assert as sinonAssert, createSandbox, SinonSandbox } from 'sinon';

import { Feedback } from './feedback.model';
import feedbackService from './feedback.service';
import { auditService, emailService, config } from '../../../dependencies';
import { NotFoundError } from '../../common/errors';
import { User } from '../user/user.model';

/**
 * Unit tests
 */
describe('Feedback Service:', () => {
	const user = new User({
		name: 'test',
		username: 'test',
		email: 'test@test.test'
	});

	let sandbox: SinonSandbox;

	beforeEach(() => {
		sandbox = createSandbox();
		sandbox.stub(auditService, 'audit').resolves();
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('sendFeedback', () => {
		it('should create mailOptions properly', async () => {
			const sendMailStub = sandbox.stub(emailService, 'sendMail').resolves();

			const feedback = new Feedback({
				body: 'feedback body',
				type: 'type',
				url: 'url'
			});

			const expectedEmailContent = `HEADER
<p>Hey there ${config.get<string>('app.title')} Admins,</p>
<p>A user named <strong>${user.name}</strong> with username <strong>${
				user.username
			}</strong> and email <strong>${
				user.email
			}</strong> has submitted the following ${feedback.type}:</p>
<p>${feedback.body}</p>
<p>Submitted from: ${feedback.url}</p>
FOOTER
`;

			await feedbackService.sendFeedbackEmail(user, feedback, {});

			sinonAssert.called(sendMailStub);
			const [mailOptions] = sendMailStub.getCall(0).args;

			assert(mailOptions, 'expected mailOptions to exist');

			assert.equal(mailOptions.bcc, config.get('coreEmails.feedbackEmail.bcc'));
			assert.equal(
				mailOptions.from,
				config.get<string>('coreEmails.default.from')
			);
			assert.equal(
				mailOptions.replyTo,
				config.get<string>('coreEmails.default.replyTo')
			);
			assert.equal(
				mailOptions.subject,
				`${config.get<string>('app.title')}: Feedback Submitted`
			);
			assert.equal(mailOptions.html, expectedEmailContent);
		});
	});

	describe('readFeedback', () => {
		it('should return feedback if a feedback ID is supplied', async () => {
			const savedFeedback = await new Feedback({
				body: 'testing',
				url: 'http://localhost:3000/home',
				type: 'Question'
			}).save();
			const feedback = await feedbackService.read(savedFeedback._id);
			assert(feedback);
		});

		it('should throw a 404 errorResult if an invalid feedback ID is supplied', async () => {
			await assert.rejects(
				() => feedbackService.read('1234'),
				new NotFoundError('Invalid feedback ID')
			);
		});

		it('should return null if a nonexistent feedback ID is supplied', async () => {
			const feedback = await feedbackService.read('123412341234123412341234');
			assert.equal(feedback, null);
		});
	});
});
