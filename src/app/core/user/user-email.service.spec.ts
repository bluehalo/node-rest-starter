import { assert, createSandbox, SinonSandbox, SinonSpy } from 'sinon';

import userEmailService from './user-email.service';
import { User } from './user.model';
import userService from './user.service';
import { config, emailService } from '../../../dependencies';
import { logger } from '../../../lib/logger';

/**
 * Unit tests
 */
describe('User Email Service:', () => {
	const user = new User({
		name: 'test',
		username: 'test',
		email: 'test@test.test',
		roles: {
			user: true
		},
		lastLoginWithAccess: Date.now()
	});

	let sandbox: SinonSandbox;

	beforeEach(() => {
		sandbox = createSandbox();
		sandbox.spy(logger, 'error');
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('emailApprovedUser', () => {
		it('error sending email', async () => {
			sandbox.stub(emailService, 'sendMail').rejects(new Error('error'));

			await userEmailService.emailApprovedUser(user);

			assert.calledOnce(logger.error as SinonSpy);
		});

		it('should create mailOptions properly', async () => {
			const expectedEmailContent = `HEADER
<p>Hello ${user.name},</p>
<br>
<p>Your ${config.get(
				'app.title'
			)} account has been approved! Come <a href="${config.get(
				'app.clientUrl'
			)}">check us out</a>!</p>
<p>Have a question? Take a look at our <a href="${config.get(
				'app.helpUrl'
			)}">Help documentation</a>.</p>
<p>If you need to contact a member of our team, you can reach us at ${config.get(
				'app.contactEmail'
			)}.</p>
<br><br>
<p>Thanks,</p>
<p>The ${config.get<string>('app.title')} Support Team</p>
FOOTER`;

			sandbox.stub(emailService, 'sendMail').resolves();

			await userEmailService.emailApprovedUser(user);

			assert.calledWithMatch(emailService.sendMail as SinonSpy, {
				to: user.email,
				from: config.get<string>('coreEmails.default.from'),
				replyTo: config.get<string>('coreEmails.default.replyTo'),
				subject: `Your ${config.get<string>(
					'app.title'
				)} account has been approved!`,
				html: expectedEmailContent
			});
			assert.notCalled(logger.error as SinonSpy);
		});
	});

	describe('signupEmail', () => {
		it('error sending email', async () => {
			sandbox.stub(emailService, 'sendMail').rejects(new Error('error'));

			await userEmailService.signupEmail(user);

			assert.calledOnce(logger.error as SinonSpy);
		});

		it('should create mailOptions properly', async () => {
			const expectedEmailContent = `HEADER
<p>Hey there ${config.get<string>('app.title')} Admins,</p>
<p>A new user named <strong>${user.name}</strong> with username <strong>${
				user.username
			}</strong> has requested an account.</p>
<p>Go to <a href="${config.get('app.clientUrl')}/admin/users">${config.get(
				'app.clientUrl'
			)}/admin/users</a> to give them access so they can start using ${config.get(
				'app.title'
			)}!</p>
FOOTER`;

			sandbox.stub(emailService, 'sendMail').resolves();

			await userEmailService.signupEmail(user);

			assert.calledWithMatch(emailService.sendMail as SinonSpy, {
				to: config.get<string>('coreEmails.userSignupAlert.to'),
				from: config.get<string>('coreEmails.default.from'),
				replyTo: config.get<string>('coreEmails.default.replyTo'),
				subject: `New Account Request - ${config.get('app.clientUrl')}`,
				html: expectedEmailContent
			});
			assert.notCalled(logger.error as SinonSpy);
		});
	});

	describe('welcomeWithAccessEmail', () => {
		beforeEach(() => {
			const configGetStub = sandbox.stub(config, 'get');
			configGetStub
				.withArgs('coreEmails.welcomeWithAccess.recentDuration')
				.returns({ seconds: 0 });
			configGetStub.callThrough();

			sandbox.stub(userService, 'updateLastLoginWithAccess').resolves();
		});

		it('error sending email', async () => {
			sandbox.stub(emailService, 'sendMail').rejects(new Error('error'));

			await userEmailService.welcomeWithAccessEmail(user);

			assert.calledOnce(logger.error as SinonSpy);
		});

		it('should create mailOptions properly', async () => {
			sandbox.stub(emailService, 'sendMail').resolves();

			const expectedEmailContent = `HEADER
<p>Welcome Back to ${config.get<string>('app.title')}, ${user.name}!</p>
<p>Have a question? Take a look at our <a href="${config.get(
				'app.helpUrl'
			)}">Help documentation</a>.</p>
<p>If you need to contact a member of our team, you can reach us at ${config.get(
				'app.contactEmail'
			)}.</p>
<br/>
<br/>
<p>Thanks,</p>
<p>The ${config.get<string>('app.title')} Support Team</p><p></p>
FOOTER
`;

			await userEmailService.welcomeWithAccessEmail(user);

			assert.calledWithMatch(emailService.sendMail as SinonSpy, {
				to: user.email,
				from: config.get<string>('coreEmails.default.from'),
				replyTo: config.get<string>('coreEmails.default.replyTo'),
				subject: `Welcome to ${config.get<string>('app.title')}!`,
				html: expectedEmailContent
			});
			assert.notCalled(logger.error as SinonSpy);
		});
	});
});
