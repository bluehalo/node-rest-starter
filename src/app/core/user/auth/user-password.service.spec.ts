import crypto from 'crypto';

import should from 'should';
import { assert, createSandbox } from 'sinon';

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

	let sandbox;

	beforeEach(() => {
		sandbox = createSandbox();
		sandbox.stub(logger, 'error').returns();
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
			should.exist(token);
			token.should.be.String();
			token.should.be.length(40);
		});

		it('error generating token', async () => {
			sandbox.stub(crypto, 'randomBytes').callsArgWith(1, new Error('error'));

			await userPasswordService
				.generateToken()
				.should.be.rejectedWith(new Error('error'));
		});
	});

	describe('setResetTokenForUser', () => {
		it('should store token for valid user', async () => {
			const user = await userPasswordService.setResetTokenForUser(
				testUser.username,
				testToken
			);

			should.exist(user, 'expected user to exist');
			should.exist(
				user.resetPasswordToken,
				'expected user.resetPasswordToken to exist'
			);
			should.exist(
				user.resetPasswordExpires,
				'expected user.resetPasswordExpires to exist'
			);
			user.resetPasswordToken.should.equal(testToken);
			user.resetPasswordExpires.should.be.greaterThan(Date.now());
		});

		it('should throw error for invalid user', async () => {
			await userPasswordService
				.setResetTokenForUser('invalid-user', testToken)
				.should.be.rejectedWith(
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

			should.exist(user, 'expected user to exist');
			should.exist(user.password, 'expected user.password to exist');
			user.password.should.not.equals(testUser.password);
			should.not.exist(
				user.resetPasswordToken,
				'expected user.resetPasswordToken to not exist'
			);
			should.not.exist(
				user.resetPasswordExpires,
				'expected user.resetPasswordExpires to not exist'
			);
		});

		it('should throw error for invalid token', async () => {
			await userPasswordService
				.resetPasswordForToken('invalid-token', '')
				.should.be.rejectedWith(
					new BadRequestError('Password reset token is invalid or has expired.')
				);
		});
	});

	describe('sendResetPasswordEmail', () => {
		it('error sending email', async () => {
			sandbox.stub(emailService, 'sendMail').rejects(new Error('error'));

			await userPasswordService.sendResetPasswordEmail(testUser, 'token', {});

			assert.calledOnce(logger.error);
		});

		it('should create mailOptions properly', async () => {
			const expectedEmailContent = `HEADER
<p>Hey there ${testUser.name},</p>
<br>
<p>It looks like you've asked us to reset your ${config.app.title} account password.</p>
<p>If that sounds right, you can go to this url to complete the process:</p>
<p>${config.app.clientUrl}/password/reset/${testToken}</p>
<strong>If you didn't make this request, you can ignore this email.</strong>
<br>
<br>
<p>Thanks,</p>
<p>The ${config.app.title} Support Team</p>
FOOTER`;

			sandbox.stub(emailService, 'sendMail').resolves();

			await userPasswordService.sendResetPasswordEmail(testUser, testToken, {});

			assert.calledWithMatch(emailService.sendMail, {
				to: testUser.email,
				from: config.coreEmails.default.from,
				replyTo: config.coreEmails.default.replyTo,
				subject: 'Password Reset',
				html: expectedEmailContent
			});
		});
	});

	describe('sendPasswordResetConfirmEmail', () => {
		it('error sending email', async () => {
			sandbox.stub(emailService, 'sendMail').rejects(new Error('error'));

			await userPasswordService.sendPasswordResetConfirmEmail(testUser, {});

			assert.calledOnce(logger.error);
		});

		it('should create mailOptions properly', async () => {
			const expectedEmailContent = `HEADER
<p>Dear ${testUser.name},</p>
<p></p>
<p>This is a confirmation that the password for your account has just been changed</p>
<br>
<br>
<p>The ${config.app.title} Support Team</p>
FOOTER`;

			sandbox.stub(emailService, 'sendMail').resolves();

			await userPasswordService.sendPasswordResetConfirmEmail(testUser, {});

			assert.calledWithMatch(emailService.sendMail, {
				to: testUser.email,
				from: config.coreEmails.default.from,
				replyTo: config.coreEmails.default.replyTo,
				subject: 'Your password has been changed',
				html: expectedEmailContent
			});
		});
	});
});
