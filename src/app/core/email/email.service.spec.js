'use strict';

const should = require('should'),
	sinon = require('sinon'),
	uuid = require('uuid'),
	deps = require('../../../dependencies'),
	emailService = deps.emailService,
	config = deps.config;

/**
 * Unit tests
 */
describe('Email Service:', () => {
	let sandbox;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('getMissingMailOptions:', () => {
		it('should find required missing fields', () => {
			let missing = emailService.getMissingMailOptions({});
			missing.length.should.equal(4);
			missing[0].should.equal('("to" or "cc" or "bcc")');
			missing[1].should.equal('"from"');
			missing[2].should.equal('"subject"');
			missing[3].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({ to: null });
			missing.length.should.equal(4);
			missing[0].should.equal('("to" or "cc" or "bcc")');
			missing[1].should.equal('"from"');
			missing[2].should.equal('"subject"');
			missing[3].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({ to: undefined });
			missing.length.should.equal(4);
			missing[0].should.equal('("to" or "cc" or "bcc")');
			missing[1].should.equal('"from"');
			missing[2].should.equal('"subject"');
			missing[3].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({ to: '' });
			missing.length.should.equal(4);
			missing[0].should.equal('("to" or "cc" or "bcc")');
			missing[1].should.equal('"from"');
			missing[2].should.equal('"subject"');
			missing[3].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({
				to: null,
				from: '',
				html: null
			});
			missing.length.should.equal(4);
			missing[0].should.equal('("to" or "cc" or "bcc")');
			missing[1].should.equal('"from"');
			missing[2].should.equal('"subject"');
			missing[3].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({
				to: 'recipient',
				from: '',
				html: null
			});
			missing.length.should.equal(3);
			missing[0].should.equal('"from"');
			missing[1].should.equal('"subject"');
			missing[2].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({ to: 'recipient' });
			missing.length.should.equal(3);
			missing[0].should.equal('"from"');
			missing[1].should.equal('"subject"');
			missing[2].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({ from: 'sender' });
			missing.length.should.equal(3);
			missing[0].should.equal('("to" or "cc" or "bcc")');
			missing[1].should.equal('"subject"');
			missing[2].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({
				to: 'recipient',
				from: 'sender',
				html: '("text" or "html")'
			});
			missing.length.should.equal(1);
			missing[0].should.equal('"subject"');

			missing = emailService.getMissingMailOptions({
				to: 'recipient',
				from: 'sender',
				html: '("text" or "html")',
				subject: '"subject"'
			});
			missing.length.should.equal(0);
		});
	});

	describe('sendMail:', () => {
		it('should fail for invalid mail provider', async () => {
			sandbox.stub(deps.config, 'mailer').value({});

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
			let error = null;
			try {
				await emailService.sendMail({ to: 'to', from: 'from', html: 'html' });
			} catch (err) {
				error = err;
			}
			error.should.not.be.null();
			error.message.should.not.be.null();
			error.message.should.equal(
				'The following required values were not specified in mailOptions: "subject"'
			);
		});
		it('should work', async () => {
			await emailService.sendMail({
				to: 'to',
				from: 'from',
				html: 'html',
				subject: 'test'
			});
		});
	});

	describe('buildEmailContent:', () => {
		const header = uuid.v4();
		const footer = uuid.v4();

		const user = {
			name: 'test'
		};

		beforeEach(() => {
			sandbox.stub(deps.config, 'coreEmails').value({
				default: {
					header,
					footer
				}
			});
		});

		it('should build email content', async () => {
			const expectedResult = `${header}
<p>Welcome to ${config.app.title}, ${user.name}!</p>
<p>Have a question? Take a look at our <a href="${config.app.helpUrl}">Help documentation</a>.</p>
<p>If you need to contact a member of our team, you can reach us at ${config.app.contactEmail}.</p>
<br/>
<br/>
<p>Thanks,</p>
<p>The ${config.app.title} Support Team</p><p></p>
${footer}
`;

			const subject = await emailService.buildEmailContent(
				'src/app/core/user/templates/user-welcome-with-access-email.server.view.html',
				user
			);
			should.exist(subject);
			subject.should.equal(expectedResult);
		});

		it('should throw error for invalid template path', async () => {
			let error;
			let subject;
			try {
				subject = await emailService.buildEmailContent(
					'src/app/core/user/templates/file-that-doesnt-exist.view.html',
					user
				);
			} catch (err) {
				error = err;
			}
			should.exist(error);
			should.not.exist(subject);
		});
	});

	describe('buildEmailSubject:', () => {
		it('should build email subject', () => {
			sandbox.stub(deps.config, 'coreEmails').value({
				default: {
					subjectPrefix: '(pre)'
				}
			});

			const subject = emailService.buildEmailSubject(
				'{{ subjectPrefix }} subject {{ otherVariable }}',
				{},
				{ otherVariable: '2' }
			);
			should.exist(subject);
			subject.should.equal('(pre) subject 2');

			const subject2 = emailService.buildEmailSubject(
				'{{ subjectPrefix }} subject {{ otherVariable }}',
				{}
			);
			should.exist(subject2);
			subject2.should.equal('(pre) subject ');
		});
	});

	describe('generateMailOptions', () => {
		const header = uuid.v4();
		const footer = uuid.v4();

		const user = {
			name: 'test'
		};

		beforeEach(() => {
			sandbox.stub(deps.config, 'coreEmails').value({
				default: {
					header,
					footer
				}
			});
		});

		it('should return merged mail options', async () => {
			const emailConfig = {
				subject: 'Test',
				templatePath:
					'src/app/core/user/templates/user-welcome-with-access-email.server.view.html'
			};

			const options = await emailService.generateMailOptions(
				user,
				{},
				emailConfig
			);

			should.exist(options);
			options.header.should.equal(header);
			options.footer.should.equal(footer);
			options.subject.should.equal(emailConfig.subject);
		});

		it('should log and throw error', async () => {
			const emailConfig = {
				subject: 'Test',
				templatePath:
					'src/app/core/user/templates/file-that-doesnt-exist.view.html'
			};

			let options;
			let error;
			try {
				options = await emailService.generateMailOptions(user, {}, emailConfig);
			} catch (err) {
				error = err;
			}

			should.not.exist(options);
			should.exist(error);
		});
	});
});
