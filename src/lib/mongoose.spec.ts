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
			dbs.should.have.property('admin');
			dbs.admin.should.have.property('connection');

			const admin = dbs.admin as Mongoose;
			admin.connection.name.should.eql(adminDatabaseName);
			admin.connection.readyState.should.eql(1);
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
			dbs.should.have.property('admin');
			dbs.admin.should.have.property('connection');

			const admin = dbs.admin as Mongoose;
			admin.connection.name.should.eql(adminDatabaseName);
			admin.connection.readyState.should.eql(1);
		});

		it('connects to other databases', async () => {
			const dbs = await mongooseLib.connect();
			dbs.should.have.property('other');

			const other = dbs.other as Connection;
			other.name.should.eql(otherDatabaseName);
			other.readyState.should.eql(1);
		});

		it('models registered to admin db should not be available on other db', async () => {
			const dbs = await mongooseLib.connect();
			dbs.should.have.property('admin');
			dbs.should.have.property('other');

			intersection(
				dbs.admin.modelNames(),
				dbs.other.modelNames()
			).length.should.eql(0);
		});
	});
});
