import { DateTime } from 'luxon';
import { assert, createSandbox } from 'sinon';

import InactiveUsersJobService from './inactive-user.job';
import { config, emailService } from '../../../../dependencies';
import { logger } from '../../../../lib/logger';

/**
 * Unit tests
 */
describe('User Email Service:', () => {
	const inactiveUsersJobService = new InactiveUsersJobService();
	const daysAgo = 90;

	const user = {
		name: 'test',
		username: 'test',
		email: 'test@test.test',
		lastLogin: DateTime.now().toUTC().minus({ days: daysAgo }).toMillis()
	};

	let sandbox;

	beforeEach(() => {
		sandbox = createSandbox();
		sandbox.stub(logger, 'error').returns();
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('sendEmail', () => {
		it('should create mailOptions properly for deactivate template', async () => {
			const expectedEmailContent = `HEADER
<p>Hello ${user.name},</p>
<br>
<p>It seems you haven't logged into your ${config.get(
				'app.title'
			)} account in ${daysAgo} days.</p>
<p>Therefore, your account has been deactivated.</p>
<p>Please contact us at ${config.get(
				'app.contactEmail'
			)} if you have any questions.</p>
<br>
<br>
<p>Thanks,</p>
<p>The ${config.get('app.title')} Support Team</p>
FOOTER`;

			sandbox.stub(emailService, 'sendMail').resolves();

			await inactiveUsersJobService.sendEmail(
				user,
				config.get('coreEmails.userDeactivate')
			);

			assert.calledWithMatch(emailService.sendMail, {
				to: user.email,
				from: config.get('coreEmails.default.from'),
				replyTo: config.get('coreEmails.default.replyTo'),
				subject: `${config.get('app.title')}: Account Deactivation`,
				html: expectedEmailContent
			});

			assert.notCalled(logger.error);
		});

		it('should create mailOptions properly for inactivity template', async () => {
			const expectedEmailContent = `HEADER
<p>Hello ${user.name},</p>
<br>
<p>It seems you haven't logged into your ${config.get(
				'app.title'
			)} account in ${daysAgo} days. Why not check in and see what's new!</p>
<p>Have a question or just want to know what's new? Take a look at our Message of the Day page:</p>
<p>${config.get('app.clientUrl')}</p>
<br>
<p>Keep in mind that all accounts that have been inactive for a period of at least 90 days are deactivated.</p>
<br>
<br>
<p>Thanks,</p>
<p>The ${config.get('app.title')} Support Team</p>
FOOTER`;

			sandbox.stub(emailService, 'sendMail').resolves();

			await inactiveUsersJobService.sendEmail(
				user,
				config.get('coreEmails.userInactivity')
			);

			assert.calledWithMatch(emailService.sendMail, {
				to: user.email,
				from: config.get('coreEmails.default.from'),
				replyTo: config.get('coreEmails.default.replyTo'),
				subject: `${config.get('app.title')}: Inactivity Notice`,
				html: expectedEmailContent
			});

			assert.notCalled(logger.error);
		});
	});
});
