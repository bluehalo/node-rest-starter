'use strict';

const
	proxyquire = require('proxyquire'),
	should = require('should'),
	_ = require('lodash'),
	deps = require('../../../dependencies'),
	config = deps.config;

/**
 * Globals
 */

/**
 * Unit tests
 */

function createSubjectUnderTest(config) {
	const stubConfig = _.merge({

	}, config);

	const stubs = {};
	stubs['../../../dependencies'] = { config: stubConfig };
	return proxyquire('./email.service', stubs);
}

describe('Email Service:', () => {

	describe('getMissingMailOptions:', () => {

		it('should find required missing fields', () => {
			let emailService = createSubjectUnderTest();

			let missing = emailService.getMissingMailOptions({});
			missing.length.should.equal(4);
			missing[0].should.equal('("to" or "cc" or "bcc")');
			missing[1].should.equal('"from"');
			missing[2].should.equal('"subject"');
			missing[3].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({to: null});
			missing.length.should.equal(4);
			missing[0].should.equal('("to" or "cc" or "bcc")');
			missing[1].should.equal('"from"');
			missing[2].should.equal('"subject"');
			missing[3].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({to: undefined});
			missing.length.should.equal(4);
			missing[0].should.equal('("to" or "cc" or "bcc")');
			missing[1].should.equal('"from"');
			missing[2].should.equal('"subject"');
			missing[3].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({to: ''});
			missing.length.should.equal(4);
			missing[0].should.equal('("to" or "cc" or "bcc")');
			missing[1].should.equal('"from"');
			missing[2].should.equal('"subject"');
			missing[3].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({to: null, from: '', html: null});
			missing.length.should.equal(4);
			missing[0].should.equal('("to" or "cc" or "bcc")');
			missing[1].should.equal('"from"');
			missing[2].should.equal('"subject"');
			missing[3].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({to: 'recipient', from: '', html: null});
			missing.length.should.equal(3);
			missing[0].should.equal('"from"');
			missing[1].should.equal('"subject"');
			missing[2].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({to: 'recipient'});
			missing.length.should.equal(3);
			missing[0].should.equal('"from"');
			missing[1].should.equal('"subject"');
			missing[2].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({from: 'sender'});
			missing.length.should.equal(3);
			missing[0].should.equal('("to" or "cc" or "bcc")');
			missing[1].should.equal('"subject"');
			missing[2].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({to: 'recipient', from: 'sender', html: '("text" or "html")'});
			missing.length.should.equal(1);
			missing[0].should.equal('"subject"');

			missing = emailService.getMissingMailOptions({to: 'recipient', from: 'sender', html: '("text" or "html")', subject: '"subject"'});
			missing.length.should.equal(0);
		});

	});

	describe('sendMail:', () => {
		it('should fail for invalid mail provider', async () => {
			let emailService = createSubjectUnderTest({
			});

			let error = null;

			try {
				await emailService.sendMail();
			} catch (err) {
				error = err;
			}
			error.should.not.be.null();
			error.message.should.not.be.null();
			error.message.should.equal('Email service is not configured');
		});

		it('should fail for null mailOptions', async () => {
			let emailService = createSubjectUnderTest({
				mailer: {
					provider:  './src/app/core/email/providers/log-email.provider.js'
				}
			});

			let error = null;

			try {
				await emailService.sendMail();
			} catch (err) {
				error = err;
			}
			error.should.not.be.null();
			error.message.should.not.be.null();
			error.message.should.equal('No email options specified');
		});

		it('should fail for incomplete mailOptions', async () => {
			let emailService = createSubjectUnderTest({
				mailer: {
					provider:  './src/app/core/email/providers/log-email.provider.js'
				}
			});

			let error = null;
			try {
				await emailService.sendMail({ to: 'to', from: 'from', html: 'html' });
			} catch (err) {
				error = err;
			}
			error.should.not.be.null();
			error.message.should.not.be.null();
			error.message.should.equal('The following required values were not specified in mailOptions: "subject"');
		});
		it('should work', async () => {
			let emailService = createSubjectUnderTest({
				mailer: {
					provider:  './src/app/core/email/providers/log-email.provider.js'
				}
			});

			await emailService.sendMail({ to: 'to', from: 'from', html: 'html', subject: 'test' });
		});
	});

	describe('buildEmailContent:', () => {
		it('should build email content', async () => {
			let emailService = createSubjectUnderTest({
				app: config.app,
				coreEmails: {
					default: {
						header: 'header',
						footer: 'footer'
					}
				}
			});

			const user = {
				name: 'test'
			};

			let expectedResult = `<p>Welcome to ${config.app.title}, ${user.name}!</p>
<p>Thanks for requesting an account! We've alerted our admins and they will be reviewing your request shortly. </p>
<p>While you're waiting, click <a href="${config.app.clientUrl}/help/getting-started">here</a> to learn more about our system.</p>
<br/>
<br/>
<p>Thanks,</p>
<p>The ${config.app.title} Support Team</p><p></p>
`;

			let subject = await emailService.buildEmailContent('src/app/core/user/templates/user-welcome-email.server.view.html', user);
			should.exist(subject);
			subject.should.equal(expectedResult);
		});
	});

	describe('buildEmailSubject:', () => {
		it('should build email subject', async () => {
			let emailService = createSubjectUnderTest({
				coreEmails: {
					default: {
						subjectPrefix: '(pre)'
					}
				}
			});

			let subject = emailService.buildEmailSubject('{{ subjectPrefix }} subject {{ otherVariable }}', {}, { otherVariable: '2'});
			should.exist(subject);
			subject.should.equal('(pre) subject 2');
		});
	});

});
