import { logger } from '../../../../dependencies';
import { JobService } from '../../../common/agenda/job-service';
import preferenceService from './preference.service';

/**
 * Clean up orphaned preferences (referenced user no longer exists)
 */
export default class PreferenceCleanupJobService implements JobService {
	async run() {
		const preferences = await preferenceService.searchAll({}, [
			{ path: 'user', select: ['_id'] }
		]);

		await Promise.all(
			preferences
				.filter((preference) => !preference.user)
				.map((preference) => {
					// depopulate to get access to the nonexistent user id for logging
					preference.depopulate('user');
					logger.debug(
						`Removing preference=${preference._id} owned by nonexistent user=${preference.user}`
					);
					return preference.remove();
				})
		);
	}
}
