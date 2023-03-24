import { Job } from 'agenda';

export interface JobService {
	run: (job: Job) => Promise<unknown>;
}
