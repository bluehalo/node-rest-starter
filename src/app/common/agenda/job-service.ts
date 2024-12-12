import { Job } from 'agenda';
import { JobAttributesData } from 'agenda/dist/job';

export interface JobService<T extends JobAttributesData = JobAttributesData> {
	run: (job: Job<T>) => Promise<unknown>;
}
