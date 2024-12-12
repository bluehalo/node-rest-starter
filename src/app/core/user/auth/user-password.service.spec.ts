import crypto from 'crypto';
import assert from 'node:assert/strict';

import {
	assert as sinonAssert,
	createSandbox,
	SinonSpy,
	SinonSandbox
} from 'sinon';

import userPasswordService from './user-password.service';
import { config, emailService } from '../../../../dependencies';
import { logger } from '../../../../lib/logger';
import { BadRequestError } from '../../../common/errors';
import { User } from '../user.model';

/**
 * Unit tests
 */
describe('User Password Service:', () => {
	const testUser = new User({
		name: 'Test User',
		username: 'test',
		email: 'test@domain.com',
		organization: 'org',
		provider: 'provider',
		password: 'test'
	});
	const testToken = 'test_token';

	let sandbox: SinonSandbox;

	beforeEach(() => {
		sandbox = createSandbox();
		sandbox.spy(logger, 'error');
	});

	afterEach(() => {
		sandbox.restore();
	});

	const clearDB = () => User.deleteMany({}).exec();

	before(clearDB);
	after(clearDB);

	before(async () => {
		await User.create(testUser);
	});

	describe('generateToken', () => {
		it('should generate token', async () => {
			const token = await userPasswordService.generateToken();
			assert(token);
			assert.equal(typeof token, 'string', 'expected token to be a string');
			assert.equal(token.length, 40);
		});

		it('error generating token', async () => {
			sandbox.stub(crypto, 'randomBytes').callsArgWith(1, new Error('error'));

			await assert.rejects(
				userPasswordService.generateToken(),
				new Error('error')
			);
		});
	});

	describe('setResetTokenForUser', () => {
		it('should store token for valid user', async () => {
			const user = await userPasswordService.setResetTokenForUser(
				testUser.username,
				testToken
			);

			assert(user, 'expected user to exist');
			assert(
				user.resetPasswordToken,
				'expected user.resetPasswordToken to exist'
			);
			assert(
				user.resetPasswordExpires,
				'expected user.resetPasswordExpires to exist'
			);
			assert.equal(user.resetPasswordToken, testToken);
			assert(
				user.resetPasswordExpires.getTime() > Date.now(),
				'expected resetPasswordExpires to be greater than "now'
			);
		});

		it('should throw error for invalid user', async () => {
			await assert.rejects(
				userPasswordService.setResetTokenForUser('invalid-user', testToken),
				new BadRequestError('No account with that username has been found.')
			);
		});
	});

	describe('resetPasswordForToken', () => {
		it('', async () => {
			const user = await userPasswordService.resetPasswordForToken(
				testToken,
				'password'
			);

			assert(user, 'expected user to exist');
			assert(user.password, 'expected user.password to exist');
			assert.notEqual(user.password, testUser.password);
			assert.equal(user.resetPasswordToken, undefined);
			assert.equal(user.resetPasswordExpires, undefined);
		});

		it('should throw error for invalid token', async () => {
			await assert.rejects(
				userPasswordService.resetPasswordForToken('invalid-token', ''),
				new BadRequestError('Password reset token is invalid or has expired.')
			);
		});
	});

	describe('sendResetPasswordEmail', () => {
		it('error sending email', async () => {
			sandbox.stub(emailService, 'sendMail').rejects(new Error('error'));

			await userPasswordService.sendResetPasswordEmail(testUser, 'token', {});

			sinonAssert.calledOnce(logger.error as SinonSpy);
		});

		it('should create mailOptions properly', async () => {
			const expectedEmailContent = `HEADER
<p>Hey there ${testUser.name},</p>
<br>
<p>It looks like you've asked us to reset your ${config.get(
				'app.title'
			)} account password.</p>
<p>If that sounds right, you can go to this url to complete the process:</p>
<p>${config.get('app.clientUrl')}/password/reset/${testToken}</p>
<strong>If you didn't make this request, you can ignore this email.</strong>
<br>
<br>
<p>Thanks,</p>
<p>The ${config.get<string>('app.title')} Support Team</p>
FOOTER`;

			sandbox.stub(emailService, 'sendMail').resolves();

			await userPasswordService.sendResetPasswordEmail(testUser, testToken, {});

			sinonAssert.calledWithMatch(emailService.sendMail as SinonSpy, {
				to: testUser.email,
				from: config.get<string>('coreEmails.default.from'),
				replyTo: config.get<string>('coreEmails.default.replyTo'),
				subject: 'Password Reset',
				html: expectedEmailContent
			});
		});
	});

	describe('sendPasswordResetConfirmEmail', () => {
		it('error sending email', async () => {
			sandbox.stub(emailService, 'sendMail').rejects(new Error('error'));

			await userPasswordService.sendPasswordResetConfirmEmail(testUser, {});

			sinonAssert.calledOnce(logger.error as SinonSpy);
		});

		it('should create mailOptions properly', async () => {
			const expectedEmailContent = `HEADER
<p>Dear ${testUser.name},</p>
<p></p>
<p>This is a confirmation that the password for your account has just been changed</p>
<br>
<br>
<p>The ${config.get<string>('app.title')} Support Team</p>
FOOTER`;

			sandbox.stub(emailService, 'sendMail').resolves();

			await userPasswordService.sendPasswordResetConfirmEmail(testUser, {});

			sinonAssert.calledWithMatch(emailService.sendMail as SinonSpy, {
				to: testUser.email,
				from: config.get<string>('coreEmails.default.from'),
				replyTo: config.get<string>('coreEmails.default.replyTo'),
				subject: 'Your password has been changed',
				html: expectedEmailContent
			});
		});
	});
});
