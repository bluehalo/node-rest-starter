import crypto from 'node:crypto';
import { promisify } from 'node:util';

import { DateTime } from 'luxon';

import { config, emailService } from '../../../../dependencies';
import { logger } from '../../../../lib/logger';
import { BadRequestError } from '../../../common/errors';
import { User, UserDocument, UserModel } from '../user.model';

class UserPasswordService {
	constructor(private userModel: UserModel) {}

	findUserForActiveToken(token: string) {
		return User.findOne({
			resetPasswordToken: token,
			resetPasswordExpires: { $gt: Date.now() }
		}).exec();
	}

	async initiatePasswordReset(username: string, req: unknown) {
		try {
			const token = await this.generateToken();

			const user = await this.setResetTokenForUser(username, token);

			await this.sendResetPasswordEmail(user, token, req);

			return user;
		} catch {
			throw new BadRequestError('Failure generating reset password token.');
		}
	}

	async generateToken(): Promise<string> {
		const buffer = await promisify(crypto.randomBytes)(20);
		return buffer.toString('hex');
	}

	async setResetTokenForUser(
		username: string,
		token: string
	): Promise<UserDocument> {
		// Try to find the user
		let user;
		try {
			user = await User.findOne({ username }, '-salt -password').exec();
		} catch {
			// ignore error
		}

		if (!user) {
			return Promise.reject(
				new BadRequestError('No account with that username has been found.')
			);
		}

		// Generate the token and the expire date/time
		user.resetPasswordToken = token;
		user.resetPasswordExpires = DateTime.now().plus({ hours: 1 }).toJSDate();

		// Save the user with the token
		return user.save();
	}

	async resetPasswordForToken(
		token: string,
		password: string
	): Promise<UserDocument> {
		try {
			const user = await module.exports.findUserForActiveToken(token);

			if (!user) {
				return Promise.reject(
					new BadRequestError('Password reset token is invalid or has expired.')
				);
			}

			user.password = password;
			user.resetPasswordToken = undefined;
			user.resetPasswordExpires = undefined;
			return user.save();
		} catch {
			throw new BadRequestError('Failure resetting password.');
		}
	}

	// Send email to user with instructions on resetting password
	async sendResetPasswordEmail(
		user: UserDocument,
		token: string,
		req: unknown
	): Promise<void> {
		try {
			const mailOptions = await emailService.generateMailOptions(
				user,
				config.get('coreEmails.resetPassword'),
				{
					token: token
				},
				{},
				{
					to: user.email
				}
			);
			await emailService.sendMail(mailOptions);
			logger.debug(`Sent reset password email to user (${user.username})`);
		} catch (error) {
			// Log the error but this shouldn't block
			logger.error('Failure sending email.', { err: error, req: req });
		}
	}

	// Send email to user confirming password was reset
	async sendPasswordResetConfirmEmail(
		user: UserDocument,
		req: unknown
	): Promise<void> {
		try {
			const mailOptions = await emailService.generateMailOptions(
				user,
				config.get('coreEmails.resetPasswordConfirm'),
				{},
				{},
				{
					to: user.email
				}
			);
			await emailService.sendMail(mailOptions);
			logger.debug(`Sent reset password email to user (${user.username})`);
		} catch (error) {
			// Log the error but this shouldn't block
			logger.error('Failure sending email.', { err: error, req: req });
		}
	}
}

export = new UserPasswordService(User);
