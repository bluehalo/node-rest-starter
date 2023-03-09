'use strict';

import { Job } from 'agenda';
import _ from 'lodash';
import { DateTime } from 'luxon';
import { FilterQuery } from 'mongoose';

import {
	dbs,
	config,
	emailService,
	auditService,
	logger
} from '../../../../dependencies';
import { JobService } from '../../../common/agenda/job-service';
import { UserDocument, UserModel } from '../types';

const User: UserModel = dbs.admin.model('User');

/**
 * alert users whose accounts have been inactive for 30-89 days. Remove accounts that have been inactive for 90+ days
 */
export default class InactiveUsersJobService implements JobService {
	async sendEmail(user, emailConfig) {
		// This current DateTime may be a millisecond or two later than user.lastLogin due to Luxon's precision, so we round down to the number of days.
		const numOfDays = Math.floor(
			DateTime.now().diff(DateTime.fromMillis(user.lastLogin)).as('days')
		);
		try {
			const mailOptions = await emailService.generateMailOptions(
				user,
				null,
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
			logger.error({ err: error }, 'Failure sending email.');
		}
	}

	async deactivationAlert(dQuery: FilterQuery<UserDocument>) {
		const deactivatedUsers = await User.find(dQuery).exec();
		if (_.isArray(deactivatedUsers)) {
			const promises = deactivatedUsers.map(async (user) => {
				const originalUser = User.auditCopy(user);

				user.roles.admin = false;
				user.roles.user = false;
				user.markModified('roles');
				await user.save();

				await this.sendEmail(user, config.coreEmails.userDeactivate);

				await auditService.audit(
					'deactivation due to inactivity',
					'user',
					'deactivation',
					null,
					{ before: originalUser, after: User.auditCopy(user) },
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
				this.sendEmail(user, config.coreEmails.userInactivity)
			)
		);
	}

	async run(job: Job) {
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
