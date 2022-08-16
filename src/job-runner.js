'use strict';

if (!process.argv[2]) {
	/* eslint-disable no-console */
	console.log('Usage: node job-runner.js <path/to/example.job.js>');
	process.exit(1);
}

const path = require('path');
const { logger } = require('./lib/bunyan');
const mongoose = require('./lib/mongoose');

mongoose.connect().then(async () => {
	try {
		const job = require(path.posix.resolve(process.argv[2]));
		await job.run();
		process.exit(0);
	} catch (err) {
		logger.error(`Error executing job: ${process.argv[2]}`, err.message);
		process.exit(1);
	}
});
