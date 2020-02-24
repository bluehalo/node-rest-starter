'use strict';

const
	should = require('should'),
	proxyquire = require('proxyquire'),

	deps = require('../../../dependencies'),
	config = deps.config;

/**
 * Helpers
 */

function createSubjectUnderTest(dependencies) {
	const stubs = {};
	stubs['../../../dependencies'] = dependencies || {};
	return proxyquire('./user-email.service', stubs);
}

/**
 * Unit tests
 */
describe('User Email Service:', () => {

	const user = {
		name: 'test',
		username: 'test',
		email: 'test@test.test'
	};

	let mailOptions = null;

	const userEmailService = createSubjectUnderTest({
		emailService: {
			sendMail: (mo) => {
				mailOptions = mo;
			},
			buildEmailContent: deps.emailService.buildEmailContent,
			buildEmailSubject: deps.emailService.buildEmailSubject,
			generateMailOptions: deps.emailService.generateMailOptions
		}
	});

	describe('emailApprovedUser', () => {
		it('should create mailOptions properly', async() => {
			const expectedEmailContent = `<p>Hello ${user.name},</p>
<br>
<p>Your ${config.app.title} account has been approved! Come <a href="${config.app.clientUrl}">check us out</a>!</p>
<p>Have a question? Take a look at our <a href="${config.app.helpUrl}">Help documentation</a>.</p>
<p>If you need to contact a member of our team, you can reach us at ${config.app.contactEmail}.</p>
<br><br>
<p>Thanks,</p>
<p>The ${config.app.title} Support Team</p>
`;

			await userEmailService.emailApprovedUser(user, {});

			should.exist(mailOptions, 'expected mailOptions to exist');

			for (const key of ['to', 'from', 'replyTo', 'subject', 'html']) {
				should.exist(mailOptions[key], `expected mailOptions.${key} to exist`);
			}

			mailOptions.to.should.equal(user.email);
			mailOptions.from.should.equal(config.coreEmails.default.from);
			mailOptions.replyTo.should.equal(config.coreEmails.default.replyTo);
			mailOptions.subject.should.equal(`Your ${config.app.title} account has been approved!`);
			mailOptions.html.should.equal(expectedEmailContent);
		});
	});

	describe('signupEmail', () => {
		it('should create mailOptions properly', async() => {
			const expectedEmailContent = `<p>Hey there ${config.app.title} Admins,</p>
<p>A new user named <b>${user.name}</b> with username <b>${user.username}</b> has requested an account.</p>
<p>Go to <a href="${config.app.clientUrl}/admin/users">${config.app.clientUrl}/admin/users</a> to give them access so they can start using ${config.app.title}!</p>
`;

			await userEmailService.signupEmail(user, {});

			should.exist(mailOptions, 'expected mailOptions to exist');

			for (const key of ['to', 'from', 'replyTo', 'subject', 'html']) {
				should.exist(mailOptions[key], `expected mailOptions.${key} to exist`);
			}

			mailOptions.to.should.equal(config.coreEmails.userSignupAlert.to);
			mailOptions.from.should.equal(config.coreEmails.default.from);
			mailOptions.replyTo.should.equal(config.coreEmails.default.replyTo);
			mailOptions.subject.should.equal(`New Account Request - ${config.app.serverUrl}`);
			mailOptions.html.should.equal(expectedEmailContent);
		});
	});

	describe('welcomeEmail', () => {
		it('should create mailOptions properly', async() => {
			const expectedEmailContent = `<p>Welcome to ${config.app.title}, ${user.name}!</p>
<p>Thanks for requesting an account! We've alerted our admins and they will be reviewing your request shortly. </p>
<p>While you're waiting, click <a href="${config.app.clientUrl}/help/getting-started">here</a> to learn more about our system.</p>
<br/>
<br/>
<p>Thanks,</p>
<p>The ${config.app.title} Support Team</p><p></p>
`;

			await userEmailService.welcomeEmail(user, {});

			should.exist(mailOptions, 'expected mailOptions to exist');

			for (const key of ['to', 'from', 'replyTo', 'subject', 'html']) {
				should.exist(mailOptions[key], `expected mailOptions.${key} to exist`);
			}

			mailOptions.to.should.equal(user.email);
			mailOptions.from.should.equal(config.coreEmails.default.from);
			mailOptions.replyTo.should.equal(config.coreEmails.default.replyTo);
			mailOptions.subject.should.equal(`Welcome to ${config.app.title}!`);
			mailOptions.html.should.equal(expectedEmailContent);
		});
	});
});
