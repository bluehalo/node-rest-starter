'use strict';

const { DateTime } = require('luxon');
const should = require('should'),
	proxyquire = require('proxyquire'),
	deps = require('../../../../dependencies'),
	config = deps.config;

/**
 * Helpers
 */

function createSubjectUnderTest(dependencies) {
	const stubs = {};
	stubs['../../../../dependencies'] = dependencies || {};
	return proxyquire('./inactive-user-email.service', stubs);
}

/**
 * Unit tests
 */
describe('User Email Service:', () => {
	const daysAgo = 90;

	const user = {
		name: 'test',
		username: 'test',
		email: 'test@test.test',
		lastLogin: DateTime.now().toUTC().minus({ days: daysAgo }).toMillis()
	};

	describe('sendEmail', () => {
		let mailOptions = null;

		const inactiveUserEmailService = createSubjectUnderTest({
			// config: config,
			emailService: {
				sendMail: (mo) => {
					mailOptions = mo;
				},
				buildEmailContent: deps.emailService.buildEmailContent,
				buildEmailSubject: deps.emailService.buildEmailSubject,
				generateMailOptions: deps.emailService.generateMailOptions
			}
		});

		it('should create mailOptions properly for deactivate template', async () => {
			const expectedEmailContent = `HEADER
<p>Hello ${user.name},</p>
<br>
<p>It seems you haven't logged into your ${config.app.title} account in ${daysAgo} days.</p>
<p>Therefore, your account has been deactivated.</p>
<p>Please contact us at ${config.app.contactEmail} if you have any questions.</p>
<br>
<br>
<p>Thanks,</p>
<p>The ${config.app.title} Support Team</p>
FOOTER`;

			await inactiveUserEmailService.sendEmail(
				user,
				config.coreEmails.userDeactivate
			);

			should.exist(mailOptions, 'expected mailOptions to exist');

			for (const key of ['to', 'from', 'replyTo', 'subject', 'html']) {
				should.exist(mailOptions[key], `expected mailOptions.${key} to exist`);
			}

			mailOptions.to.should.equal(user.email);
			mailOptions.from.should.equal(config.coreEmails.default.from);
			mailOptions.replyTo.should.equal(config.coreEmails.default.replyTo);
			mailOptions.subject.should.equal(
				`${config.app.title}: Account Deactivation`
			);
			mailOptions.html.should.equal(expectedEmailContent);
		});

		it('should create mailOptions properly for inactivity template', async () => {
			const expectedEmailContent = `HEADER
<p>Hello ${user.name},</p>
<br>
<p>It seems you haven't logged into your ${config.app.title} account in ${daysAgo} days. Why not check in and see what's new!</p>
<p>Have a question or just want to know what's new? Take a look at our Message of the Day page:</p>
<p>${config.app.clientUrl}</p>
<br>
<p>Keep in mind that all accounts that have been inactive for a period of at least 90 days are deactivated.</p>
<br>
<br>
<p>Thanks,</p>
<p>The ${config.app.title} Support Team</p>
FOOTER`;

			await inactiveUserEmailService.sendEmail(
				user,
				config.coreEmails.userInactivity
			);

			should.exist(mailOptions, 'expected mailOptions to exist');

			for (const key of ['to', 'from', 'replyTo', 'subject', 'html']) {
				should.exist(mailOptions[key], `expected mailOptions.${key} to exist`);
			}

			mailOptions.to.should.equal(user.email);
			mailOptions.from.should.equal(config.coreEmails.default.from);
			mailOptions.replyTo.should.equal(config.coreEmails.default.replyTo);
			mailOptions.subject.should.equal(
				`${config.app.title}: Inactivity Notice`
			);
			mailOptions.html.should.equal(expectedEmailContent);
		});
	});
});
