const { Agenda } = require('agenda/es'),
	path = require('path'),
	config = require('../config'),
	{ logger } = require('./bunyan');

const registerJobs = (agenda) => {
	logger.info(`Registering ${config.agenda.jobs.length} job(s)...`);

	config.agenda.jobs.forEach((jobConfig) => {
		logger.info(`Registering job: ${jobConfig.name}`);
		const jobService = require(path.posix.resolve(jobConfig.file));
		if (jobService.register) {
			jobService.register(agenda, jobConfig.name, jobConfig.options ?? {});
		} else {
			agenda.define(jobConfig.name, jobConfig.options ?? {}, (job) => {
				logger.debug({ job: jobConfig.name }, 'Running job');
				jobService
					.run(job)
					.catch((err) => {
						logger.error({ job: jobConfig.name }, 'Error running job', err);
						// Ignore any errors
						return Promise.resolve();
					})
					.then(() => {
						logger.debug({ job: jobConfig.name }, 'Job complete');
					});
			});
		}
	});
};

const scheduleJobs = (agenda) => {
	const jobsToSchedule = config.agenda.jobs.filter((job) => job.interval);

	logger.info(`Scheduling ${jobsToSchedule.length} job(s)...`);

	return Promise.all(
		jobsToSchedule.map((job) => {
			logger.info(`Scheduling job: ${job.name} [${job.interval}]`);
			agenda.every(job.interval, job.name, job.data ?? null, job.options ?? {});
		})
	);
};

module.exports.init = () => {
	if (config.agenda?.enabled !== true) {
		// agenda must be enabled explicitly in the config
		return;
	}

	logger.info('Initializing Agenda.js...');
	const agenda = new Agenda({
		db: { address: config.db.admin }
	});
	registerJobs(agenda);

	agenda.on('ready', async () => {
		await agenda.start();
		await scheduleJobs(agenda);
		logger.info('Agenda.js ready...');
	});
};
