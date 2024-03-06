import should from 'should';
import { createSandbox } from 'sinon';
import uuid from 'uuid';

import { config, emailService } from '../../../dependencies';

/**
 * Unit tests
 */
describe('Email Service:', () => {
	let sandbox;

	beforeEach(() => {
		sandbox = createSandbox();
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('validateMailOptions:', () => {
		it('should find required missing fields', () => {
			[
				{},
				{ to: undefined },
				{ to: '' },
				{
					to: null,
					from: '',
					html: null
				}
			].forEach((options) => {
				should(() => {
					emailService.validateMailOptions(options);
				}).throw(
					new Error(
						'The following required values were not specified in mailOptions: ("to" or "cc" or "bcc"), "from", "subject", ("text" or "html")'
					)
				);
			});

			[
				{ to: 'recipient' },
				{
					to: 'recipient',
					from: '',
					html: null
				}
			].forEach((options) => {
				should(() => {
					emailService.validateMailOptions(options);
				}).throw(
					new Error(
						'The following required values were not specified in mailOptions: "from", "subject", ("text" or "html")'
					)
				);
			});

			should(() => {
				emailService.validateMailOptions({ from: 'sender' });
			}).throw(
				new Error(
					'The following required values were not specified in mailOptions: ("to" or "cc" or "bcc"), "subject", ("text" or "html")'
				)
			);

			should(() => {
				emailService.validateMailOptions({
					to: 'recipient',
					from: 'sender',
					html: '("text" or "html")'
				});
			}).throw(
				new Error(
					'The following required values were not specified in mailOptions: "subject"'
				)
			);

			should(() => {
				emailService.validateMailOptions({
					to: 'recipient',
					from: 'sender',
					html: '("text" or "html")',
					subject: 'subject'
				});
			}).not.throwError();
		});
	});

	describe('sendMail:', () => {
		it('should fail for invalid mail provider', async () => {
			// Need to clear cached provider from service to ensure proper test run.
			emailService.provider = null;

			sandbox.stub(config, 'mailer').value({});

			await emailService
				.sendMail({})
				.should.be.rejectedWith(new Error('Email service is not configured'));
		});

		it('should fail for null mailOptions', async () => {
			await emailService
				.sendMail()
				.should.be.rejectedWith(new Error('No email options specified'));
		});

		it('should fail for incomplete mailOptions', async () => {
			await emailService
				.sendMail({ to: 'to', from: 'from', html: 'html' })
				.should.be.rejectedWith(
					new Error(
						'The following required values were not specified in mailOptions: "subject"'
					)
				);
		});
		it('should work', async () => {
			await emailService
				.sendMail({
					to: 'to',
					from: 'from',
					html: 'html',
					subject: 'test'
				})
				.should.not.be.rejected();
		});
	});

	describe('buildEmailContent:', () => {
		const header = uuid.v4();
		const footer = uuid.v4();

		const user = {
			name: 'test'
		};

		beforeEach(() => {
			sandbox.stub(config, 'coreEmails').value({
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
			await emailService
				.buildEmailContent(
					'src/app/core/user/templates/file-that-doesnt-exist.view.html',
					user
				)
				.should.be.rejected();
		});
	});

	describe('buildEmailSubject:', () => {
		it('should build email subject', () => {
			sandbox.stub(config, 'coreEmails').value({
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
			sandbox.stub(config, 'coreEmails').value({
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

			await emailService
				.generateMailOptions(user, {}, emailConfig)
				.should.be.rejected();
		});
	});
});
