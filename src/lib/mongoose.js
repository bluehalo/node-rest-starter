'use strict';

const _ = require('lodash'),
	mongoose = require('mongoose'),
	path = require('path'),
	config = require('../config'),
	logger = require('./bunyan').logger;

// Set the mongoose debugging option based on the configuration, defaulting to false
const mongooseDebug = config.mongooseLogging || false;
logger.info(`Mongoose: Setting debug to ${mongooseDebug}`);
mongoose.set('debug', mongooseDebug);

// Load the mongoose models
function loadModels() {
	// Globbing model files
	config.files.models.forEach((modelPath) => {
		logger.debug(`Mongoose: Loading ${modelPath}`);
		require(path.posix.resolve(modelPath));
	});
}
module.exports.loadModels = loadModels;

/**
 * Gets a database connection specification from the configured parameters, allowing for both simple
 * connection strings in addition to complex SSL and Replica Set connections
 *
 * @param {string} dbSpecName - key for the database connection within all the configs that will be returned
 * @param {object} dbConfigs - object that contains either a basic connection string or an object with a 'uri' and 'options' attributes
 */
function getDbSpec(dbSpecName, dbConfigs) {
	const dbSpec = dbConfigs[dbSpecName];

	const connectionString = _.has(dbSpec, 'uri') ? dbSpec.uri : dbSpec;
	const options = {
		useNewUrlParser: true,
		useUnifiedTopology: true,
		useFindAndModify: false
	};
	if (_.has(dbSpec, 'options')) {
		Object.assign(options, dbSpec.options);
	}

	return {
		name: dbSpecName,
		connectionString: connectionString,
		options: options
	};
}

// This is the set of db connections
const dbs = {};
module.exports.dbs = dbs;

// Initialize Mongoose, returns a promise
module.exports.connect = async () => {
	const dbSpecs = [];
	let defaultDbSpec;

	// Organize the dbs we need to connect
	for (const dbSpec in config.db) {
		if (dbSpec === 'admin') {
			defaultDbSpec = getDbSpec(dbSpec, config.db);
		} else {
			dbSpecs.push(getDbSpec(dbSpec, config.db));
		}
	}

	// Connect to the default db to kick off the process
	if (defaultDbSpec) {
		try {
			await mongoose.connect(
				defaultDbSpec.connectionString,
				defaultDbSpec.options
			);

			logger.info(`Mongoose: Connected to "${defaultDbSpec.name}" default db`);

			// store it in the db list
			dbs[defaultDbSpec.name] = mongoose;

			// Connect to the rest of the dbs
			await Promise.all(
				dbSpecs.map(
					(spec) =>
						new Promise((resolve, reject) => {
							// Create the secondary connection
							const conn = mongoose.createConnection(
								spec.connectionString,
								spec.options
							);
							dbs[spec.name] = conn;
							conn.on('connected', () => {
								logger.debug(`Connected to ${spec.name}`);
								resolve();
							});
							conn.on('error', () => {
								reject();
							});
						})
				)
			);

			mongoose.set('useCreateIndex', true);

			logger.debug('Loading mongoose models...');
			// Since all the db connections worked, we will load the mongoose models
			loadModels();
			logger.debug('Loaded all mongoose models!');

			// Ensure that all mongoose models are initialized
			// before responding with the connections(s)
			await Promise.all(
				Object.entries(dbs).map(([key, conn]) => {
					logger.debug(`Initializing all models for ${key}`);
					return Promise.all(
						Object.entries(conn.models).map(([name, aModel]) => {
							logger.debug(`Initializing model ${name}`);
							return aModel.init();
						})
					);
				})
			);

			// Return the dbs since everything succeeded
			return dbs;
		} catch (err) {
			logger.fatal('Mongoose: Could not connect to admin db');
			throw err;
		}
	}
};

//Disconnect from Mongoose
module.exports.disconnect = () => {
	// Create defers for mongoose connections
	const promises = _.values(this.dbs).map((d) => {
		if (d.disconnect) {
			return d.disconnect().catch(() => Promise.resolve());
		}
		return Promise.resolve();
	});

	// Wait for all to finish, successful or not
	return Promise.all(promises);
};
