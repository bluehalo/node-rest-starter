import assert from 'node:assert/strict';

import { createSandbox, SinonSandbox } from 'sinon';
import * as uuid from 'uuid';

import { config, emailService } from '../../../dependencies';
import { User } from '../user/user.model';

/**
 * Unit tests
 */
describe('Email Service:', () => {
	let sandbox: SinonSandbox;

	beforeEach(() => {
		sandbox = createSandbox();
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('validateMailOptions:', () => {
		it('should find required missing fields', () => {
			for (const options of [
				{},
				{ to: undefined },
				{ to: '' },
				{
					to: null,
					from: '',
					html: null
				}
			]) {
				assert.throws(() => {
					emailService.validateMailOptions(options);
				}, new Error('The following required values were not specified in mailOptions: ("to" or "cc" or "bcc"), "from", "subject", ("text" or "html")'));
			}

			for (const options of [
				{ to: 'recipient' },
				{
					to: 'recipient',
					from: '',
					html: null
				}
			] as Record<string, unknown>[]) {
				assert.throws(() => {
					emailService.validateMailOptions(options);
				}, new Error('The following required values were not specified in mailOptions: "from", "subject", ("text" or "html")'));
			}

			assert.throws(() => {
				emailService.validateMailOptions({ from: 'sender' });
			}, new Error('The following required values were not specified in mailOptions: ("to" or "cc" or "bcc"), "subject", ("text" or "html")'));

			assert.throws(() => {
				emailService.validateMailOptions({
					to: 'recipient',
					from: 'sender',
					html: '("text" or "html")'
				});
			}, new Error('The following required values were not specified in mailOptions: "subject"'));

			assert.doesNotThrow(() => {
				emailService.validateMailOptions({
					to: 'recipient',
					from: 'sender',
					html: '("text" or "html")',
					subject: 'subject'
				});
			});
		});
	});

	describe('sendMail:', () => {
		it('should fail for invalid mail provider', async () => {
			// Need to clear cached provider from service to ensure proper test run.
			emailService.provider = null;

			sandbox
				.stub(config, 'has')
				.callThrough()
				.withArgs('mailer.provider')
				.returns(false);

			await assert.rejects(
				emailService.sendMail({}),
				new Error('Email service is not configured')
			);
		});

		it('should fail for null mailOptions', async () => {
			await assert.rejects(
				emailService.sendMail(),
				new Error('No email options specified')
			);
		});

		it('should fail for incomplete mailOptions', async () => {
			await assert.rejects(
				emailService.sendMail({ to: 'to', from: 'from', html: 'html' }),
				new Error(
					'The following required values were not specified in mailOptions: "subject"'
				)
			);
		});
		it('should work', async () => {
			await assert.doesNotReject(
				emailService.sendMail({
					to: 'to',
					from: 'from',
					html: 'html',
					subject: 'test'
				})
			);
		});
	});

	describe('buildEmailContent:', () => {
		const header = uuid.v4();
		const footer = uuid.v4();

		const user = new User({
			name: 'test'
		});

		beforeEach(() => {
			const configGetStub = sandbox.stub(config, 'get');
			configGetStub.withArgs('coreEmails.default').returns({
				header,
				footer
			});
			configGetStub.callThrough();
		});

		it('should build email content', async () => {
			const expectedResult = `${header}
<p>Welcome to ${config.get<string>('app.title')}, ${user.name}!</p>
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
${footer}
`;

			const subject = await emailService.buildEmailContent(
				'src/app/core/user/templates/user-welcome-with-access-email.server.view.html',
				user.toObject()
			);
			assert.ok(subject);
			assert.equal(subject, expectedResult);
		});

		it('should throw error for invalid template path', async () => {
			await assert.rejects(
				emailService.buildEmailContent(
					'src/app/core/user/templates/file-that-doesnt-exist.view.html',
					user
				)
			);
		});
	});

	describe('buildEmailSubject:', () => {
		it('should build email subject', () => {
			sandbox
				.stub(config, 'get')
				.callThrough()
				.withArgs('coreEmails.default')
				.returns({
					subjectPrefix: '(pre)'
				});
			// sandbox.stub(config, 'coreEmails').value({
			// 	default: {
			// 		subjectPrefix: '(pre)'
			// 	}
			// });

			const user = new User({});

			const subject = emailService.buildEmailSubject(
				'{{ subjectPrefix }} subject {{ otherVariable }}',
				user,
				{ otherVariable: '2' }
			);
			assert.ok(subject);
			assert.equal(subject, '(pre) subject 2');

			const subject2 = emailService.buildEmailSubject(
				'{{ subjectPrefix }} subject {{ otherVariable }}',
				user
			);
			assert.ok(subject2);
			assert.equal(subject2, '(pre) subject ');
		});
	});

	describe('generateMailOptions', () => {
		const header = uuid.v4();
		const footer = uuid.v4();

		const user = new User({
			name: 'test'
		});

		beforeEach(() => {
			const configGetStub = sandbox.stub(config, 'get');
			configGetStub.withArgs('coreEmails.default').returns({
				header,
				footer
			});
			configGetStub.callThrough();
		});

		it('should return merged mail options', async () => {
			const emailConfig = {
				subject: 'Test',
				templatePath:
					'src/app/core/user/templates/user-welcome-with-access-email.server.view.html'
			};

			const options = await emailService.generateMailOptions(user, emailConfig);

			assert.ok(options);
			assert.equal(options.header, header);
			assert.equal(options.footer, footer);
			assert.equal(options.subject, emailConfig.subject);
		});

		it('should log and throw error', async () => {
			const emailConfig = {
				subject: 'Test',
				templatePath:
					'src/app/core/user/templates/file-that-doesnt-exist.view.html'
			};

			await assert.rejects(emailService.generateMailOptions(user, emailConfig));
		});
	});
});
