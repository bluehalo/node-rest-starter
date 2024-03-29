import should from 'should';
import { assert, createSandbox } from 'sinon';

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

	let sandbox;

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
<p>Hey there ${config.get('app.title')} Admins,</p>
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

			assert.called(sendMailStub);
			const [mailOptions] = sendMailStub.getCall(0).args;

			should.exist(mailOptions, 'expected mailOptions to exist');

			for (const key of ['bcc', 'from', 'replyTo', 'subject', 'html']) {
				should.exist(mailOptions[key], `expected mailOptions.${key} to exist`);
			}

			mailOptions.bcc.should.equal(config.get('coreEmails.feedbackEmail.bcc'));
			mailOptions.from.should.equal(config.get('coreEmails.default.from'));
			mailOptions.replyTo.should.equal(
				config.get('coreEmails.default.replyTo')
			);
			mailOptions.subject.should.equal(
				`${config.get('app.title')}: Feedback Submitted`
			);
			mailOptions.html.should.equal(expectedEmailContent);
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
			should.exist(feedback);
		});

		it('should throw a 404 errorResult if an invalid feedback ID is supplied', async () => {
			await feedbackService
				.read('1234')
				.should.be.rejectedWith(new NotFoundError('Invalid feedback ID'));
		});

		it('should return null if a nonexistent feedback ID is supplied', async () => {
			const feedback = await feedbackService.read('123412341234');
			should.not.exist(feedback);
		});
	});
});
