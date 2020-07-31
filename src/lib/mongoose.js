'use strict';

const _ = require('lodash'),
	mongoose = require('mongoose'),
	path = require('path'),

	config = require('../config'),
	logger = require('./bunyan').logger;


// Set the mongoose debugging option based on the configuration, defaulting to false
const mongooseDebug = (config.mongooseLogging) || false;
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
module.exports.connect = () => {
	const dbSpecs = [];
	let defaultDbSpec;


	// Organize the dbs we need to connect
	for(const dbSpec in config.db) {
		if(dbSpec === 'admin') {
			defaultDbSpec = getDbSpec(dbSpec, config.db);
		}
		else {
			dbSpecs.push(getDbSpec(dbSpec, config.db));
		}
	}


	// Connect to the default db to kick off the process
	if (defaultDbSpec) {
		return mongoose.connect(defaultDbSpec.connectionString, defaultDbSpec.options).then((result) => {
			logger.info(`Mongoose: Connected to "${defaultDbSpec.name}" default db`);

			// store it in the db list
			dbs[defaultDbSpec.name] = mongoose;

			// Connect to the rest of the dbs
			dbSpecs.forEach((spec) => {
				// Create the secondary connection
				dbs[spec.name] = mongoose.createConnection(spec.connectionString, spec.options);
			});

			mongoose.set('useCreateIndex', true);

			// Since all the db connections worked, we will load the mongoose models
			loadModels();

			// Resolve the dbs since everything succeeded
			return dbs;

		}).catch((err) => {
			logger.fatal('Mongoose: Could not connect to admin db');
			return Promise.reject(err);
		});
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
