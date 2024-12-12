import config from 'config';
import { DateTime, DurationInput } from 'luxon';

import userAuthorizationService from './auth/user-authorization.service';
import { UserDocument } from './user.model';
import userService from './user.service';
import { emailService } from '../../../dependencies';
import { logger } from '../../../lib/logger';

class UserEmailService {
	// Send email alert to system admins about new account request
	async emailApprovedUser(user: UserDocument) {
		if (!config.get('coreEmails.approvedUserEmail.enabled')) {
			return;
		}
		try {
			const mailOptions = await emailService.generateMailOptions(
				user,
				config.get('coreEmails.approvedUserEmail'),
				{},
				{},
				{
					to: user.email
				}
			);
			await emailService.sendMail(mailOptions);
		} catch (error) {
			// Log the error but this shouldn't block
			logger.error('Failure sending email.', { err: error });
		}
	}

	// Send email alert to system admins about new account request
	async signupEmail(user: UserDocument) {
		if (!config.get('coreEmails.userSignupAlert.enabled')) {
			return;
		}
		try {
			const mailOptions = await emailService.generateMailOptions(
				user,
				config.get('coreEmails.userSignupAlert')
			);
			await emailService.sendMail(mailOptions);
		} catch (error) {
			// Log the error but this shouldn't block the user from signing up
			logger.error('Failure sending email.', { err: error });
		}
	}

	// Send welcome email to new user
	async welcomeNoAccessEmail(user: UserDocument) {
		if (!config.get('coreEmails.welcomeNoAccess.enabled')) {
			return;
		}
		const skipForRole = config.get<string>(
			'coreEmails.welcomeNoAccess.skipIfUserHasRole'
		);
		if (!skipForRole || !userAuthorizationService.hasRole(user, skipForRole)) {
			try {
				const mailOptions = await emailService.generateMailOptions(
					user,
					config.get('coreEmails.welcomeNoAccess'),
					{},
					{},
					{
						to: user.email
					}
				);
				await emailService.sendMail(mailOptions);
			} catch (error) {
				// Log the error but this shouldn't block the user from signing up
				logger.error('Failure sending email.', { err: error });
			}
		}
	}

	// Send welcome email to new user
	async welcomeWithAccessEmail(user: UserDocument) {
		if (!config.get('coreEmails.welcomeWithAccess.enabled')) {
			return;
		}

		const recentCutoff = DateTime.now().minus(
			config.get<DurationInput>('coreEmails.welcomeWithAccess.recentDuration')
		);
		const accessRole = config.get<string>(
			'coreEmails.welcomeWithAccess.accessRole'
		);

		if (accessRole && userAuthorizationService.hasRole(user, accessRole)) {
			if (recentCutoff.toMillis() > user.lastLoginWithAccess?.getTime()) {
				try {
					const mailOptions = await emailService.generateMailOptions(
						user,
						config.get('coreEmails.welcomeWithAccess'),
						{},
						{},
						{
							to: user.email
						}
					);
					await emailService.sendMail(mailOptions);
				} catch (error) {
					// Log the error but this shouldn't block the user from signing up
					logger.error('Failure sending email.', { err: error });
				}
			}
			userService.updateLastLoginWithAccess(user);
		}
	}
}

export = new UserEmailService();
