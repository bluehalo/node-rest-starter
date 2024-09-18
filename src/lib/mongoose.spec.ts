import assert from 'node:assert';

import config from 'config';
import { intersection } from 'lodash';
import { Connection, Mongoose } from 'mongoose';
import { createSandbox } from 'sinon';

import * as mongooseLib from './mongoose';

describe('Mongoose', () => {
	const mongoHost = config.get('test.mongoHost');
	const adminDatabaseName = 'mean-test-mongoose-admin';
	const otherDatabaseName = 'mean-test-mongoose-other';

	let sandbox;

	before(() => {
		return mongooseLib.disconnect();
	});

	after(() => {
		return mongooseLib.connect();
	});

	beforeEach(() => {
		sandbox = createSandbox();
	});

	afterEach(() => {
		sandbox.restore();
		return mongooseLib.disconnect();
	});

	describe('when only given admin database', () => {
		beforeEach(() => {
			sandbox.stub(config, 'db').value({
				admin: `mongodb://${mongoHost}/${adminDatabaseName}`
			});
		});

		it('connects to admin database by default', async () => {
			const dbs = await mongooseLib.connect();
			assert(dbs.admin);
			assert(dbs.admin['connection']);

			const admin = dbs.admin as Mongoose;
			assert.equal(admin.connection.name, adminDatabaseName);
			assert.equal(admin.connection.readyState, 1);
		});
	});

	describe('when given multiple databases', () => {
		beforeEach(() => {
			sandbox.stub(config, 'db').value({
				admin: `mongodb://${mongoHost}/${adminDatabaseName}`,
				other: `mongodb://${mongoHost}/${otherDatabaseName}`
			});
		});

		it('connects to admin database by default', async () => {
			const dbs = await mongooseLib.connect();
			assert(dbs.admin);
			assert(dbs.admin['connection']);

			const admin = dbs.admin as Mongoose;
			assert.equal(admin.connection.name, adminDatabaseName);
			assert.equal(admin.connection.readyState, 1);
		});

		it('connects to other databases', async () => {
			const dbs = await mongooseLib.connect();
			assert(dbs.other);

			const other = dbs.other as Connection;
			assert.equal(other.name, otherDatabaseName);
			assert.equal(other.readyState, 1);
		});

		it('models registered to admin db should not be available on other db', async () => {
			const dbs = await mongooseLib.connect();
			assert(dbs.admin);
			assert(dbs.other);

			assert.equal(
				intersection(dbs.admin.modelNames(), dbs.other.modelNames()).length,
				0
			);
		});
	});
});
