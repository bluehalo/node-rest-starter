import path from 'path';

import _ from 'lodash';
import mongoose, { Connection, ConnectOptions, Mongoose } from 'mongoose';

import config from '../config';
import { logger } from './bunyan';

// Set the mongoose debugging option based on the configuration, defaulting to false
const mongooseDebug = config.mongooseLogging ?? false;

logger.info(`Mongoose: Setting debug to ${mongooseDebug}`);
mongoose.set('debug', mongooseDebug);

// Load the mongoose models
export const loadModels = async () => {
	// Globbing model files
	for (const modelPath of config.files.models) {
		logger.debug(`Mongoose: Loading ${modelPath}`);
		// eslint-disable-next-line no-await-in-loop
		await import(path.posix.resolve(modelPath));
	}
};

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
	const options = {};
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
export const dbs: Record<string, Connection | Mongoose> = {};

// Initialize Mongoose, returns a promise
export const connect = async () => {
	const dbSpecs: Array<{
		name: string;
		connectionString: string;
		options: ConnectOptions;
	}> = [];
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
				dbSpecs.map(async (spec) => {
					// Create the secondary connection
					dbs[spec.name] = await mongoose
						.createConnection(spec.connectionString, spec.options)
						.asPromise();
					logger.info(`Mongoose: Connected to "${spec.name}" db`);
				})
			);

			logger.debug('Loading mongoose models...');
			// Since all the db connections worked, we will load the mongoose models
			await loadModels();
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
export const disconnect = () => {
	// Create defers for mongoose connections
	const promises = _.values(dbs).map((d) => {
		if (isMongoose(d) && d.disconnect) {
			return d.disconnect().catch(() => Promise.resolve());
		}
		return Promise.resolve();
	});

	// Wait for all to finish, successful or not
	return Promise.all(promises);
};

function isMongoose(connection: Mongoose | Connection): connection is Mongoose {
	return (connection as Mongoose).disconnect !== undefined;
}
