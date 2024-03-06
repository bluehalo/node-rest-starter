import { DateTime } from 'luxon';

import userAuthorizationService from './auth/user-authorization.service';
import { UserDocument } from './user.model';
import userService from './user.service';
import { config, emailService } from '../../../dependencies';
import { logger } from '../../../lib/logger';

class UserEmailService {
	// Send email alert to system admins about new account request
	async emailApprovedUser(user: UserDocument, req) {
		try {
			const mailOptions = await emailService.generateMailOptions(
				user,
				req,
				config.coreEmails.approvedUserEmail,
				{},
				{},
				{
					to: user.email
				}
			);
			await emailService.sendMail(mailOptions);
		} catch (error) {
			// Log the error but this shouldn't block
			logger.error('Failure sending email.', { err: error, req: req });
		}
	}

	// Send email alert to system admins about new account request
	async signupEmail(user: UserDocument, req) {
		if (!(config.coreEmails?.userSignupAlert?.enabled ?? false)) {
			return;
		}
		try {
			const mailOptions = await emailService.generateMailOptions(
				user,
				req,
				config.coreEmails.userSignupAlert
			);
			await emailService.sendMail(mailOptions);
		} catch (error) {
			// Log the error but this shouldn't block the user from signing up
			logger.error('Failure sending email.', { err: error, req: req });
		}
	}

	// Send welcome email to new user
	async welcomeNoAccessEmail(user: UserDocument, req) {
		if (!(config.coreEmails?.welcomeNoAccess?.enabled ?? false)) {
			return;
		}
		const skipForRole = config.coreEmails.welcomeNoAccess.skipIfUserHasRole;
		if (!skipForRole || !userAuthorizationService.hasRole(user, skipForRole)) {
			try {
				const mailOptions = await emailService.generateMailOptions(
					user,
					req,
					config.coreEmails.welcomeNoAccess,
					{},
					{},
					{
						to: user.email
					}
				);
				await emailService.sendMail(mailOptions);
			} catch (error) {
				// Log the error but this shouldn't block the user from signing up
				logger.error('Failure sending email.', { err: error, req: req });
			}
		}
	}

	// Send welcome email to new user
	async welcomeWithAccessEmail(user: UserDocument, req) {
		if (!(config.coreEmails?.welcomeWithAccess?.enabled ?? false)) {
			return;
		}

		const recentCutoff = DateTime.now().minus(
			config.coreEmails.welcomeWithAccess.recentDuration ?? {
				days: 90
			}
		);
		const accessRole = config.coreEmails.welcomeWithAccess.accessRole;

		if (accessRole && userAuthorizationService.hasRole(user, accessRole)) {
			if (recentCutoff.toMillis() > user.lastLoginWithAccess?.getTime()) {
				try {
					const mailOptions = await emailService.generateMailOptions(
						user,
						req,
						config.coreEmails.welcomeWithAccess,
						{},
						{},
						{
							to: user.email
						}
					);
					await emailService.sendMail(mailOptions);
				} catch (error) {
					// Log the error but this shouldn't block the user from signing up
					logger.error('Failure sending email.', { err: error, req: req });
				}
			}
			userService.updateLastLoginWithAccess(user);
		}
	}
}

export = new UserEmailService();
