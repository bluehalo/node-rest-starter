/* eslint-disable no-console */
import config from 'config';
import { globSync } from 'glob';
import Mocha, { MochaOptions } from 'mocha';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

import * as mongoose from './lib/mongoose';

const args = yargs(hideBin(process.argv)).option({
	ci: { type: 'boolean' },
	bail: { type: 'boolean' },
	filter: { type: 'string' }
});

/**
 * This coercion is required due to yarg's unfortunate split {} | Promise<{}> typing.
 * TSC tries to reconcile the two types and is unable to do so.
 * @see https://github.com/yargs/yargs/issues/2175ß
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const argv: any = args.argv;

console.info('Starting initialization of tests');

// Initialize mongoose
mongoose
	.connect()
	.then(() => {
		console.info('Mongoose connected, proceeding with tests');

		process.on('exit', () => {
			mongoose.disconnect().then();
		});

		// Create the mocha instance
		const options: MochaOptions = argv.ci
			? {
					reporter: 'xunit',
					reporterOptions: {
						output: 'mocha-tests.xml'
					}
				}
			: {
					reporter: 'spec'
				};

		if (argv.bail) {
			console.log("Mocha: Setting option 'bail' to true.");
			options.bail = true;
		}
		const mocha = new Mocha(options);

		// Add all the tests to mocha
		let testCount = 0;
		for (const file of globSync(config.get<string[]>('assets.tests'))) {
			if (!argv.filter || new RegExp(argv.filter).test(file)) {
				testCount++;
				mocha.addFile(file);
			}
		}
		console.log(`Mocha: Executing ${testCount} test files.`);

		try {
			// Run the tests.
			mocha.run((failures) => {
				process.exit(failures ? 1 : 0);
			});
		} catch (error) {
			console.error('Tests Crashed');
			console.error(error);
			process.exit(1);
		}
	})
	.catch((error) => {
		console.error('Mongoose initialization failed, tests failed.');
		console.error(error);
		// non-zero exit code to let the process know that we've failed
		process.exit(1);
	});
