import { Job } from 'agenda';
import { DateTime } from 'luxon';
import { FilterQuery } from 'mongoose';

import { config, emailService, auditService } from '../../../../dependencies';
import { logger } from '../../../../lib/logger';
import { JobService } from '../../../common/agenda/job-service';
import { EmailTemplateConfig } from '../../email/email.service';
import { User, UserDocument } from '../user.model';

type InactiveUsersJobAttributesData = {
	alertIntervals: number[];
	deactivateAfter: number;
};

/**
 * alert users whose accounts have been inactive for 30-89 days. Remove accounts that have been inactive for 90+ days
 */
export default class InactiveUsersJobService
	implements JobService<InactiveUsersJobAttributesData>
{
	async sendEmail(user: UserDocument, emailConfig: EmailTemplateConfig) {
		// This current DateTime may be a millisecond or two later than user.lastLogin due to Luxon's precision, so we round down to the number of days.
		const numOfDays = Math.floor(
			DateTime.now().diff(DateTime.fromJSDate(user.lastLogin)).as('days')
		);
		try {
			const mailOptions = await emailService.generateMailOptions(
				user,
				emailConfig,
				{
					daysAgo: numOfDays
				},
				{},
				{
					to: user.email
				}
			);
			await emailService.sendMail(mailOptions);
			logger.debug('Sent team request email');
		} catch (error) {
			// Log the error but this shouldn't block
			logger.error('Failure sending email.', { err: error });
		}
	}

	async deactivationAlert(dQuery: FilterQuery<UserDocument>) {
		const deactivatedUsers = await User.find(dQuery).exec();
		if (Array.isArray(deactivatedUsers)) {
			const promises = deactivatedUsers.map(async (user) => {
				const originalUser = user.auditCopy();

				user.roles.admin = false;
				user.roles.user = false;
				user.markModified('roles');
				await user.save();

				await this.sendEmail(user, config.get('coreEmails.userDeactivate'));

				await auditService.audit(
					'deactivation due to inactivity',
					'user',
					'deactivation',
					null,
					{ before: originalUser, after: user.auditCopy() },
					null
				);
			});

			return Promise.all(promises);
		}
	}

	async inactivityAlert(dQuery: FilterQuery<UserDocument>) {
		const inactiveUsers = await User.find(dQuery).exec();
		return Promise.all(
			inactiveUsers.map((user) =>
				this.sendEmail(user, config.get('coreEmails.userInactivity'))
			)
		);
	}

	async run(job: Job<InactiveUsersJobAttributesData>) {
		const alertQueries = job.attrs.data.alertIntervals.map((interval) => ({
			lastLogin: {
				$lte: DateTime.now().minus({ milliseconds: interval }).toJSDate(),
				$gt: DateTime.now()
					.minus({ milliseconds: interval, days: 1 })
					.toJSDate()
			},
			'roles.user': true
		}));

		const deactivateQuery = {
			lastLogin: {
				$lte: DateTime.now()
					.minus({ milliseconds: job.attrs.data.deactivateAfter })
					.toJSDate()
			},
			'roles.user': true
		};

		await Promise.all([
			this.deactivationAlert(deactivateQuery),
			...alertQueries.map((query) => this.inactivityAlert(query))
		]).then();
	}
}
