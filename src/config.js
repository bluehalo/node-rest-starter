/* eslint-disable no-console */
'use strict';

const _ = require('lodash'),
	chalk = require('chalk').default,
	glob = require('glob'),
	path = require('path');

/**
 * Validate NODE_ENV existence
 */
function validateEnvironmentVariable() {
	if (null == process.env.NODE_ENV) {
		process.env.NODE_ENV = 'default';

		// Using console.log because this stuff happens before the environment is configured yet
		console.log(
			'NODE_ENV not set, using default environment: "default" instead.'
		);
	} else {
		console.log(`NODE_ENV is set to: "${process.env.NODE_ENV}"`);
	}

	// Try to get the environment file and see if we can load it
	const environmentFiles = glob.sync(`./config/env/${process.env.NODE_ENV}.js`);

	if (!environmentFiles.length) {
		console.log(
			chalk.red(
				`No configuration files found matching environment: "${process.env.NODE_ENV}"`
			)
		);
		// Reset console color
		console.log(chalk.white(''));
	}
}

function validateConfiguration(config) {
	const msg = `Configuration mode set to ${config.mode}`;
	const chalkFn =
		config.mode === 'development'
			? chalk.green
			: config.mode === 'production'
			? chalk.blue
			: chalk.yellow;
	console.log(chalkFn(msg));
}

function initDerivedConfig(config) {
	if (
		config.app &&
		config.app.url &&
		config.app.url.protocol &&
		config.app.url.host
	) {
		config.app.serverUrlWithoutPort = `${config.app.url.protocol}://${config.app.url.host}`;

		if (config.app.url.port) {
			config.app.serverUrl = `${config.app.serverUrlWithoutPort}:${config.app.url.port}`;
		} else {
			config.app.serverUrl = config.app.serverUrlWithoutPort;
		}
	}
}

/**
 * Initialize global configuration
 */
function initGlobalConfig() {
	// Validate NODE_ENV existance
	validateEnvironmentVariable();

	// Get the default config
	const defaultConfig = require(path.join(process.cwd(), 'config/env/default'));

	// Get the current config
	const environmentConfig =
		require(path.join(process.cwd(), 'config/env/', process.env.NODE_ENV)) ||
		{};

	// Merge config files
	const config = _.extend(defaultConfig, environmentConfig);

	// Validate Critical configuration settings
	validateConfiguration(config);

	// Initialize derived config values
	initDerivedConfig(config);

	return config;
}

/**
 * Set configuration object
 */
module.exports = initGlobalConfig();
