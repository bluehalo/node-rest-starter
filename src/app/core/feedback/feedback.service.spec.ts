import should from 'should';
import { assert, createSandbox } from 'sinon';

import { auditService, emailService, config, dbs } from '../../../dependencies';
import { UserModel } from '../user/types';
import { FeedbackModel } from './feedback.model';
import feedbackService from './feedback.service';

const User: UserModel = dbs.admin.model('User');
const Feedback: FeedbackModel = dbs.admin.model('Feedback');

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
<p>Hey there ${config.app.title} Admins,</p>
<p>A user named <strong>${user.name}</strong> with username <strong>${user.username}</strong> and email <strong>${user.email}</strong> has submitted the following ${feedback.type}:</p>
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

			mailOptions.bcc.should.equal(config.coreEmails.feedbackEmail.bcc);
			mailOptions.from.should.equal(config.coreEmails.default.from);
			mailOptions.replyTo.should.equal(config.coreEmails.default.replyTo);
			mailOptions.subject.should.equal(
				`${config.app.title}: Feedback Submitted`
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

		it('should throw a 400 errorResult if an invalid feedback ID is supplied', async () => {
			let error = null;
			try {
				await feedbackService.read('1234');
			} catch (e) {
				error = e;
			}
			should.exist(error);
			error.status.should.equal(400);
			error.message.should.equal('Invalid feedback ID');
			error.type.should.equal('validation');
		});

		it('should return null if a nonexistent feedback ID is supplied', async () => {
			const feedback = await feedbackService.read('123412341234');
			should.not.exist(feedback);
		});
	});
});
