import { Job } from 'agenda';

import { dbs, logger } from '../../../../dependencies';
import { JobService } from '../../../common/agenda/job-service';
import accessChecker from '../access-checker.service';
import { CacheEntryModel } from './cache-entry.model';

const CacheEntry: CacheEntryModel = dbs.admin.model('CacheEntry');

export default class CacheRefreshJobService implements JobService {
	async run(job: Job) {
		const refresh = job.attrs.data.refresh ?? 8 * 3600000; // default to 8 hours;

		// Find all the keys that need to be refreshed
		const results = await CacheEntry.find({
			ts: { $lt: Date.now() - refresh }
		}).exec();

		logger.info('[cache-refresh]: Refreshing %s users', results.length);

		// Iterate through each object, refreshing as you go
		const refreshes = results.map((e) => {
			logger.debug('[cache-refresh] Refreshing %s', e.key);
			return accessChecker.refreshEntry(e.key);
		});

		await Promise.all(refreshes);
	}
}
