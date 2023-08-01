import { assert, createSandbox } from 'sinon';

import userEmailService from './user-email.service';
import { UserModel } from './user.model';
import userService from './user.service';
import { config, dbs, emailService, logger } from '../../../dependencies';

const User = dbs.admin.model('User') as UserModel;

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

	let sandbox;

	beforeEach(() => {
		sandbox = createSandbox();
		sandbox.stub(logger, 'error').returns();
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('emailApprovedUser', () => {
		it('error sending email', async () => {
			sandbox.stub(emailService, 'sendMail').rejects(new Error('error'));

			await userEmailService.emailApprovedUser(user, {});

			assert.calledOnce(logger.error);
		});

		it('should create mailOptions properly', async () => {
			const expectedEmailContent = `HEADER
<p>Hello ${user.name},</p>
<br>
<p>Your ${config.app.title} account has been approved! Come <a href="${config.app.clientUrl}">check us out</a>!</p>
<p>Have a question? Take a look at our <a href="${config.app.helpUrl}">Help documentation</a>.</p>
<p>If you need to contact a member of our team, you can reach us at ${config.app.contactEmail}.</p>
<br><br>
<p>Thanks,</p>
<p>The ${config.app.title} Support Team</p>
FOOTER`;

			sandbox.stub(emailService, 'sendMail').resolves();

			await userEmailService.emailApprovedUser(user, {});

			assert.calledWithMatch(emailService.sendMail, {
				to: user.email,
				from: config.coreEmails.default.from,
				replyTo: config.coreEmails.default.replyTo,
				subject: `Your ${config.app.title} account has been approved!`,
				html: expectedEmailContent
			});
			assert.notCalled(logger.error);
		});
	});

	describe('signupEmail', () => {
		it('error sending email', async () => {
			sandbox.stub(emailService, 'sendMail').rejects(new Error('error'));

			await userEmailService.signupEmail(user, {});

			assert.calledOnce(logger.error);
		});

		it('should create mailOptions properly', async () => {
			const expectedEmailContent = `HEADER
<p>Hey there ${config.app.title} Admins,</p>
<p>A new user named <strong>${user.name}</strong> with username <strong>${user.username}</strong> has requested an account.</p>
<p>Go to <a href="${config.app.clientUrl}/admin/users">${config.app.clientUrl}/admin/users</a> to give them access so they can start using ${config.app.title}!</p>
FOOTER`;

			sandbox.stub(emailService, 'sendMail').resolves();

			await userEmailService.signupEmail(user, {});

			assert.calledWithMatch(emailService.sendMail, {
				to: config.coreEmails.userSignupAlert.to,
				from: config.coreEmails.default.from,
				replyTo: config.coreEmails.default.replyTo,
				subject: `New Account Request - ${config.app.serverUrl}`,
				html: expectedEmailContent
			});
			assert.notCalled(logger.error);
		});
	});

	describe('welcomeWithAccessEmail', () => {
		it('error sending email', async () => {
			sandbox
				.stub(config.coreEmails.welcomeWithAccess, 'recentDuration')
				.value({ seconds: 0 });
			sandbox.stub(emailService, 'sendMail').rejects(new Error('error'));
			sandbox.stub(userService, 'updateLastLoginWithAccess').resolves();

			await userEmailService.welcomeWithAccessEmail(user, {});

			assert.calledOnce(logger.error);
		});

		it('should create mailOptions properly', async () => {
			const expectedEmailContent = `HEADER
<p>Welcome Back to ${config.app.title}, ${user.name}!</p>
<p>Have a question? Take a look at our <a href="${config.app.helpUrl}">Help documentation</a>.</p>
<p>If you need to contact a member of our team, you can reach us at ${config.app.contactEmail}.</p>
<br/>
<br/>
<p>Thanks,</p>
<p>The ${config.app.title} Support Team</p><p></p>
FOOTER
`;

			sandbox
				.stub(config.coreEmails.welcomeWithAccess, 'recentDuration')
				.value({ seconds: 0 });
			sandbox.stub(emailService, 'sendMail').resolves();
			sandbox.stub(userService, 'updateLastLoginWithAccess').resolves();

			await userEmailService.welcomeWithAccessEmail(user, {});

			assert.calledWithMatch(emailService.sendMail, {
				to: user.email,
				from: config.coreEmails.default.from,
				replyTo: config.coreEmails.default.replyTo,
				subject: `Welcome to ${config.app.title}!`,
				html: expectedEmailContent
			});
			assert.notCalled(logger.error);
		});
	});
});
