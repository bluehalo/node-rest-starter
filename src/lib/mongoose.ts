import path from 'path';

import config from 'config';
import { glob } from 'glob';
import _ from 'lodash';
import mongoose, {
	Connection,
	ConnectOptions,
	Mongoose,
	Model
} from 'mongoose';

import { logger } from './bunyan';

type MongooseDbConfig = Record<
	string,
	string | { uri: string; options: Record<string, unknown> }
>;

type MongooseDbSpec = {
	name: string;
	connectionString: string;
	options: ConnectOptions;
};

// Load the mongoose models
export const loadModels = async () => {
	const modelPaths = await glob(config.get<string[]>('assets.models'));
	// Globbing model files
	for (const modelPath of modelPaths) {
		logger.debug(`Mongoose: Loading ${modelPath}`);
		// eslint-disable-next-line no-await-in-loop
		await import(path.posix.resolve(modelPath));
	}
};

/**
 * Gets a database connection specification from the configured parameters, allowing for both simple
 * connection strings in addition to complex SSL and Replica Set connections
 *
 * @param dbSpecName - key for the database connection within all the configs that will be returned
 * @param dbConfigs - object that contains either a basic connection string or an object with a 'uri' and 'options' attributes
 */
function getDbSpec(dbSpecName: string, dbConfigs: MongooseDbConfig) {
	const dbConfig = dbConfigs[dbSpecName];

	if (_.isString(dbConfig)) {
		return {
			name: dbSpecName,
			connectionString: dbConfig,
			options: {}
		};
	}
	return {
		name: dbSpecName,
		connectionString: dbConfig.uri,
		options: { ...dbConfig.options }
	};
}

// This is the set of db connections
export const dbs: Record<string, Connection | Mongoose> = {};

// Initialize Mongoose, returns a promise
export const connect = async () => {
	// Set the mongoose debugging option based on the configuration, defaulting to false
	const mongooseDebug = config.get('mongooseLogging');

	logger.info(`Mongoose: Setting debug to ${mongooseDebug}`);
	mongoose.set('debug', mongooseDebug);

	const dbSpecs: Array<MongooseDbSpec> = [];
	let defaultDbSpec: MongooseDbSpec;

	const dbConfig = config.get<MongooseDbConfig>('db');

	// Organize the dbs we need to connect
	for (const dbSpec in dbConfig) {
		if (dbSpec === 'admin') {
			defaultDbSpec = getDbSpec(dbSpec, dbConfig);
		} else {
			dbSpecs.push(getDbSpec(dbSpec, dbConfig));
		}
	}

	// Check for required admin db config
	if (!defaultDbSpec) {
		throw new Error('Required `admin` db not configured');
	}

	// Connect to the default db to kick off the process
	try {
		dbs[defaultDbSpec.name] = await mongoose.connect(
			defaultDbSpec.connectionString,
			defaultDbSpec.options
		);

		logger.info(`Mongoose: Connected to "${defaultDbSpec.name}" default db`);

		// Connect to the rest of the dbs
		await Promise.all(
			dbSpecs.map(async (spec: MongooseDbSpec) => {
				// Create the secondary connection
				dbs[spec.name] = await mongoose
					.createConnection(spec.connectionString, spec.options)
					.asPromise();
				logger.info(`Mongoose: Connected to "${spec.name}" db`);
			})
		);

		// Since all the db connections worked, we will load the mongoose models
		logger.debug('Mongoose: Loading mongoose models...');
		await loadModels();
		logger.debug('Mongoose: Loaded all mongoose models!');

		// Ensure that all mongoose models are initialized
		// before responding with the connections(s)
		await Promise.all(
			Object.entries(dbs).flatMap(([key, conn]) => {
				logger.debug(`Mongoose: Initializing all models for "${key}" db`);
				return Object.entries(conn.models).map(([name, aModel]) =>
					initializeModel(name, aModel)
				);
			})
		);

		// Return the dbs since everything succeeded
		return dbs;
	} catch (err) {
		logger.fatal('Mongoose: Could not connect to admin db');
		throw err;
	}
};

//Disconnect from Mongoose
export const disconnect = async () => {
	// Create defers for mongoose connections
	const promises = Object.values(dbs)
		.filter(isMongoose)
		.map((d) => d.disconnect().catch(() => Promise.resolve()));

	// Wait for all to finish, successful or not
	await Promise.all(promises);

	// Remove connections
	for (const key of Object.keys(dbs)) {
		delete dbs[key];
	}
};

async function initializeModel(name: string, model: Model<unknown>) {
	logger.debug(`Mongoose: Initializing model ${name}`);
	try {
		return await model.init();
	} catch (err) {
		logger.error(
			`Mongoose: Error creating index for ${name}: ${err.codeName} - ${err.message}`
		);
		if (
			config.get<boolean>('mongooseFailOnIndexOptionsConflict') ||
			err.codeName !== 'IndexOptionsConflict'
		) {
			throw err;
		}
	}
}

function isMongoose(connection: Mongoose | Connection): connection is Mongoose {
	return (connection as Mongoose).disconnect !== undefined;
}
