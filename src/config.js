/* eslint-disable no-console */
'use strict';

const
	_ = require('lodash'),
	chalk = require('chalk'),
	glob = require('glob'),
	path = require('path');

/**
 * Get files by glob patterns
 */
function getGlobbedPaths(globPatterns, excludes) {
	// URL paths regex
	let urlRegex = new RegExp('^(?:[a-z]+:)?//', 'i');

	// The output array
	let output = [];

	// If glob pattern is array so we use each pattern in a recursive way, otherwise we use glob
	if (_.isArray(globPatterns)) {
		globPatterns.forEach(function(globPattern) {
			output = _.union(output, getGlobbedPaths(globPattern, excludes));
		});
	} else if (_.isString(globPatterns)) {
		if (urlRegex.test(globPatterns)) {
			output.push(globPatterns);
		} else {
			let files = glob.sync(globPatterns);

			if (excludes) {
				files = files.map(function(file) {
					if (_.isArray(excludes)) {
						for (let i in excludes) {
							file = file.replace(excludes[i], '');
						}
					} else {
						file = file.replace(excludes, '');
					}

					return file;
				});
			}

			output = _.union(output, files);
		}
	}

	return output;
}


/**
 * Validate NODE_ENV existence
 */
function validateEnvironmentVariable() {
	if(null == process.env.NODE_ENV) {
		process.env.NODE_ENV = 'default';

		// Using console.log because this stuff happens before the environment is configured yet
		console.log('NODE_ENV not set, using default environment: "default" instead.');
	} else {
		console.log('NODE_ENV is set to: "' + process.env.NODE_ENV + '"');
	}

	// Try to get the environment file and see if we can load it
	let environmentFiles = glob.sync('./config/env/' + process.env.NODE_ENV + '.js');

	if (!environmentFiles.length) {
		console.log(chalk.red('No configuration files found matching environment: "' + process.env.NODE_ENV + '"'));
		// Reset console color
		console.log(chalk.white(''));
	}
}

function validateConfiguration(config) {
	let msg = `Configuration mode set to ${config.mode}`;
	let chalkFn = (config.mode === 'development') ? chalk.green : (config.mode === 'production') ? chalk.blue : chalk.yellow;
	console.log(chalkFn(msg));
}

/**
 * Initialize global configuration files
 */
function initGlobalConfigFiles(config, assets) {
	// Appending files
	config.files = {};

	// Setting Globbed model files
	config.files.models = getGlobbedPaths(assets.models);

	// Setting Globbed route files
	config.files.routes = getGlobbedPaths(assets.routes);

	// Setting Globbed config files
	config.files.configs = getGlobbedPaths(assets.config);

	// Setting Globbed socket files
	config.files.sockets = getGlobbedPaths(assets.sockets);

	// Setting Globbed test files
	config.files.tests = getGlobbedPaths(assets.tests);

	// Setting Globbed e2e test files
	config.files.e2e = getGlobbedPaths(assets.e2e);

}

function initDerivedConfig(config) {
	if (config.app && config.app.url && config.app.url.protocol && config.app.url.host) {
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
	let defaultConfig = require(path.join(process.cwd(), 'config/env/default'));

	// Get the current config
	let environmentConfig = require(path.join(process.cwd(), 'config/env/', process.env.NODE_ENV)) || {};

	// Merge config files
	let config = _.extend(defaultConfig, environmentConfig);

	// Validate Critical configuration settings
	validateConfiguration(config);

	// Get the assets
	let assets = require(path.posix.join(process.cwd(), 'config/assets'));

	// Initialize global globbed files
	initGlobalConfigFiles(config, assets);

	// Store the original assets in the config
	config.assets = assets;

	// Expose configuration utilities
	config.utils = {
		getGlobbedPaths: getGlobbedPaths
	};

	// Initialize derived config values
	initDerivedConfig(config);

	return config;
}

/**
 * Set configuration object
 */
module.exports = initGlobalConfig();
