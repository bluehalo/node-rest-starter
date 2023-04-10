import crypto from 'crypto';
import { promisify } from 'util';

import { DateTime } from 'luxon';

import { config, dbs, emailService, logger } from '../../../../dependencies';
import { UserDocument, UserModel } from '../user.model';

const User = dbs.admin.model('User') as UserModel;

class UserPasswordService {
	findUserForActiveToken(token: string) {
		return User.findOne({
			resetPasswordToken: token,
			resetPasswordExpires: { $gt: Date.now() }
		}).exec();
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
			return Promise.reject({
				message: 'No account with that username has been found.'
			});
		}

		// Generate the token and the expire date/time
		user.resetPasswordToken = token;
		user.resetPasswordExpires = DateTime.now().plus({ hours: 1 });

		// Save the user with the token
		return user.save();
	}

	async resetPasswordForToken(
		token: string,
		password: string
	): Promise<UserDocument> {
		let user;
		try {
			user = await module.exports.findUserForActiveToken(token);
		} catch {
			// ignore error
		}

		if (!user) {
			return Promise.reject({
				message: 'Password reset token is invalid or has expired.'
			});
		}

		user.password = password;
		user.resetPasswordToken = undefined;
		user.resetPasswordExpires = undefined;
		return user.save();
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
				req,
				config.coreEmails.resetPassword,
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
			logger.error({ err: error, req: req }, 'Failure sending email.');
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
				req,
				config.coreEmails.resetPasswordConfirm,
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
			logger.error({ err: error, req: req }, 'Failure sending email.');
		}
	}
}

export = new UserPasswordService();
