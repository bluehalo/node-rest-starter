const sinon = require('sinon'),
	config = require('../config.js'),
	mongooseLib = require('./mongoose');

describe('Mongoose', () => {
	const mongoHost = config?.test?.mongoHost ?? 'localhost';
	const adminDatabaseName = 'mean-test-mongoose-admin';
	const otherDatabaseName = 'mean-test-mongoose-other';

	let sandbox;

	before(() => {
		return mongooseLib.disconnect();
	});

	after(() => {
		return mongooseLib.connect();
	});

	beforeEach(async () => {
		sandbox = sinon.createSandbox();
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
			dbs.admin.connection.name.should.eql(adminDatabaseName);
			dbs.admin.connection.readyState.should.eql(1);
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
			dbs.admin.connection.name.should.eql(adminDatabaseName);
			dbs.admin.connection.readyState.should.eql(1);
		});

		it('connects to other databases', async () => {
			const dbs = await mongooseLib.connect();
			dbs.should.have.property('other');
			dbs.other.name.should.eql(otherDatabaseName);
			dbs.other.readyState.should.eql(1);
		});
	});
});
