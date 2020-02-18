'use strict';

const
	should = require('should'),
	proxyquire = require('proxyquire'),

	deps = require('../../../../dependencies'),
	dbs = deps.dbs,
	config = deps.config,

	User = dbs.admin.model('User');

/**
 * Helpers
 */

function createSubjectUnderTest(dependencies) {
	const stubs = {};
	stubs['../../../../dependencies'] = dependencies || {};
	return proxyquire('./user-password.service', stubs);
}

/**
 * Unit tests
 */
describe('User Password Service:', () => {

	const testUser = {
		name: 'Test User',
		username: 'test',
		email: 'test@domain.com',
		organization: 'org',
		provider: 'provider',
		password: 'test'
	};
	const testToken = 'test_token';

	let mailOptions = null;

	const userPasswordService = createSubjectUnderTest({
		emailService: {
			sendMail: (mo) => {
				mailOptions = mo;
			},
			buildEmailContent: deps.emailService.buildEmailContent,
			buildEmailSubject: deps.emailService.buildEmailSubject,
			generateMailOptions: deps.emailService.generateMailOptions
		}
	});

	const clearDB = () => User.remove({});

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
	});

	describe('setResetTokenForUser', () => {
		it('should store token for valid user', async () => {
			const user = await userPasswordService.setResetTokenForUser(testUser.username, testToken);

			should.exist(user, 'expected user to exist');
			should.exist(user.resetPasswordToken, 'expected user.resetPasswordToken to exist');
			should.exist(user.resetPasswordExpires, 'expected user.resetPasswordExpires to exist');
			user.resetPasswordToken.should.equal(testToken);
			user.resetPasswordExpires.should.be.greaterThan(Date.now());
		});

		it('should throw error for invalid user', async () => {
			let error;
			try {
				await userPasswordService.setResetTokenForUser('invalid-user', testToken);
			} catch (e) {
				error = e;
			}

			should.exist(error);
			should.exist(error.message);
			error.message.should.equal('No account with that username has been found.');
		});
	});

	describe('resetPasswordForToken', () => {
		it('', async () => {
			const user = await userPasswordService.resetPasswordForToken(testToken, 'password');

			should.exist(user, 'expected user to exist');
			should.exist(user.password, 'expected user.password to exist');
			user.password.should.not.equals(testUser.password);
			should.not.exist(user.resetPasswordToken, 'expected user.resetPasswordToken to not exist');
			should.not.exist(user.resetPasswordExpires, 'expected user.resetPasswordExpires to not exist');

		});

		it('should throw error for invalid token', async () => {
			let error;
			try {
				await userPasswordService.resetPasswordForToken('invalid-token');
			} catch (e) {
				error = e;
			}

			should.exist(error);
			should.exist(error.message);
			error.message.should.equal('Password reset token is invalid or has expired.');
		});
	});

	describe('sendResetPasswordEmail', () => {
		it('should create mailOptions properly', async() => {
			const expectedEmailContent = `<p>Hey there ${testUser.name},</p>
<br>
<p>It looks like you've asked us to reset your ${config.app.title} account password.</p>
<p>If that sounds right, you can go to this url to complete the process:</p>
<p>${config.app.clientUrl}/password/reset/${testToken}</p>
<strong>If you didn't make this request, you can ignore this email.</strong>
<br>
<br>
<p>Thanks,</p>
<p>The ${config.app.title} Support Team</p>
`;

			await userPasswordService.sendResetPasswordEmail(testUser, testToken, {});

			should.exist(mailOptions, 'expected mailOptions to exist');

			for (const key of ['to', 'from', 'replyTo', 'subject', 'html']) {
				should.exist(mailOptions[key], `expected mailOptions.${key} to exist`);
			}

			mailOptions.to.should.equal(testUser.email);
			mailOptions.from.should.equal(config.coreEmails.default.from);
			mailOptions.replyTo.should.equal(config.coreEmails.default.replyTo);
			mailOptions.subject.should.equal('Password Reset');
			mailOptions.html.should.equal(expectedEmailContent);
		});
	});

	describe('sendPasswordResetConfirmEmail', () => {
		it('should create mailOptions properly', async() => {
			const expectedEmailContent = `<p>Dear ${testUser.name},</p>
<p></p>
<p>This is a confirmation that the password for your account has just been changed</p>
<br>
<br>
<p>The ${config.app.title} Support Team</p>
`;

			await userPasswordService.sendPasswordResetConfirmEmail(testUser, {});

			should.exist(mailOptions, 'expected mailOptions to exist');

			for (const key of ['to', 'from', 'replyTo', 'subject', 'html']) {
				should.exist(mailOptions[key], `expected mailOptions.${key} to exist`);
			}

			mailOptions.to.should.equal(testUser.email);
			mailOptions.from.should.equal(config.coreEmails.default.from);
			mailOptions.replyTo.should.equal(config.coreEmails.default.replyTo);
			mailOptions.subject.should.equal('Your password has been changed');
			mailOptions.html.should.equal(expectedEmailContent);
		});
	});

});
