import path from 'path';

import { Agenda, Job } from 'agenda';
import config from 'config';

import { logger as baseLogger } from './logger';
import { JobService } from '../app/common/agenda/job-service';

const logger = baseLogger.child({ component: 'agenda' });

type JobConfig = {
	name: string;
	file: string;
	enabled: boolean;
	interval: string;
	data: unknown;
	options: unknown;
};

const getJobsFromConfig = () => {
	const jobsRecordOrArray =
		config.get<Record<string, JobConfig>>('agenda.jobs');

	return Object.entries(jobsRecordOrArray)
		.map(([jobName, jobConfig]) => {
			return {
				...jobConfig,
				name: jobName
			};
		})
		.filter((jobConfig) => jobConfig.enabled);
};

const registerJobs = (agenda: Agenda) => {
	const jobs = getJobsFromConfig();
	logger.info(`Registering ${jobs.length} job(s)...`);
	return Promise.all(
		jobs.map((jobConfig: JobConfig) => registerJob(agenda, jobConfig))
	);
};

const registerJob = async (agenda: Agenda, jobConfig: JobConfig) => {
	logger.info(`Registering job: ${jobConfig.name}`);
	const { default: Service } = await import(path.posix.resolve(jobConfig.file));
	const jobService: JobService = new Service();

	agenda.define(jobConfig.name, jobConfig.options ?? {}, (job: Job) => {
		logger.debug('Running job', { job: jobConfig.name });
		jobService
			.run(job)
			.catch((err) => {
				logger.error('Error running job', { job: jobConfig.name, err });
				// Ignore any errors
				return Promise.resolve();
			})
			.then(() => {
				logger.debug('Job complete', { job: jobConfig.name });
			});
	});
};

const scheduleJobs = (agenda: Agenda) => {
	const jobsToSchedule: JobConfig[] = getJobsFromConfig().filter(
		(job: JobConfig) => job.interval
	);

	logger.info(`Scheduling ${jobsToSchedule.length} job(s)...`);

	return Promise.all(
		jobsToSchedule.map((job) => {
			logger.info(`Scheduling job: ${job.name} [${job.interval}]`);
			return agenda.every(
				job.interval,
				job.name,
				job.data ?? null,
				job.options ?? {}
			);
		})
	);
};

export const init = async () => {
	if (config.get('agenda.enabled') !== true) {
		// agenda must be enabled explicitly in the config
		return;
	}

	logger.info('Initializing Agenda.js...');
	const agenda = new Agenda({
		db: { address: config.get<string>('db.admin') }
	});

	await registerJobs(agenda);

	agenda.on('ready', async () => {
		await agenda.start();
		await scheduleJobs(agenda);
		logger.info('Agenda.js ready...');
	});
};
