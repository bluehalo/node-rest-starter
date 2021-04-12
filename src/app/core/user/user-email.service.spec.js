'use strict';

const sinon = require('sinon'),
	deps = require('../../../dependencies'),
	config = deps.config,
	userEmailService = require('./user-email.service');

/**
 * Unit tests
 */
describe('User Email Service:', () => {
	const user = {
		name: 'test',
		username: 'test',
		email: 'test@test.test'
	};

	let sandbox;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		sandbox.stub(deps.logger, 'error').returns();
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('emailApprovedUser', () => {
		it('error sending email', async () => {
			sandbox.stub(deps.emailService, 'sendMail').rejects(new Error('error'));

			await userEmailService.emailApprovedUser(user, {});

			sinon.assert.calledOnce(deps.logger.error);
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

			sandbox.stub(deps.emailService, 'sendMail').resolves();

			await userEmailService.emailApprovedUser(user, {});

			sinon.assert.calledWithMatch(deps.emailService.sendMail, {
				to: user.email,
				from: config.coreEmails.default.from,
				replyTo: config.coreEmails.default.replyTo,
				subject: `Your ${config.app.title} account has been approved!`,
				html: expectedEmailContent
			});
			sinon.assert.notCalled(deps.logger.error);
		});
	});

	describe('signupEmail', () => {
		it('error sending email', async () => {
			sandbox.stub(deps.emailService, 'sendMail').rejects(new Error('error'));

			await userEmailService.signupEmail(user, {});

			sinon.assert.calledOnce(deps.logger.error);
		});

		it('should create mailOptions properly', async () => {
			const expectedEmailContent = `HEADER
<p>Hey there ${config.app.title} Admins,</p>
<p>A new user named <strong>${user.name}</strong> with username <strong>${user.username}</strong> has requested an account.</p>
<p>Go to <a href="${config.app.clientUrl}/admin/users">${config.app.clientUrl}/admin/users</a> to give them access so they can start using ${config.app.title}!</p>
FOOTER`;

			sandbox.stub(deps.emailService, 'sendMail').resolves();

			await userEmailService.signupEmail(user, {});

			sinon.assert.calledWithMatch(deps.emailService.sendMail, {
				to: config.coreEmails.userSignupAlert.to,
				from: config.coreEmails.default.from,
				replyTo: config.coreEmails.default.replyTo,
				subject: `New Account Request - ${config.app.serverUrl}`,
				html: expectedEmailContent
			});
			sinon.assert.notCalled(deps.logger.error);
		});
	});

	describe('welcomeEmail', () => {
		it('error sending email', async () => {
			sandbox.stub(deps.emailService, 'sendMail').rejects(new Error('error'));

			await userEmailService.welcomeEmail(user, {});

			sinon.assert.calledOnce(deps.logger.error);
		});

		it('should create mailOptions properly', async () => {
			const expectedEmailContent = `HEADER
<p>Welcome to ${config.app.title}, ${user.name}!</p>
<p>Thanks for requesting an account! We've alerted our admins and they will be reviewing your request shortly. </p>
<p>While you're waiting, click <a href="${config.app.clientUrl}/help/getting-started">here</a> to learn more about our system.</p>
<br/>
<br/>
<p>Thanks,</p>
<p>The ${config.app.title} Support Team</p><p></p>
FOOTER`;

			sandbox.stub(deps.emailService, 'sendMail').resolves();

			await userEmailService.welcomeEmail(user, {});

			sinon.assert.calledWithMatch(deps.emailService.sendMail, {
				to: user.email,
				from: config.coreEmails.default.from,
				replyTo: config.coreEmails.default.replyTo,
				subject: `Welcome to ${config.app.title}!`,
				html: expectedEmailContent
			});
			sinon.assert.notCalled(deps.logger.error);
		});
	});
});
