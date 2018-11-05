const
	proxyquire = require('proxyquire'),
	should = require('should');

function createSubjectUnderTest(databases) {
	const stubConfig = {
		db: databases,
		files: {
			models: []
		},
		'@noCallThru': true
	};

	const stubs = {};
	stubs['../config'] = stubConfig;
	return proxyquire('./mongoose', stubs);
}

describe('Mongoose', () => {

	const originalMongooseLib = require('./mongoose');

	before(() => {
		return originalMongooseLib.disconnect();
	});

	after(() => {
		return originalMongooseLib.connect();
	});

	describe('when only given admin database', () => {

		let mongooseLib;

		const adminDatabaseName = 'mean2-test-mongoose-admin';

		beforeEach(() => {
			mongooseLib = createSubjectUnderTest({
				admin: `mongodb://localhost/${adminDatabaseName}`
			});
		});

		afterEach(() => {
			return mongooseLib.disconnect();
		});

		it('connects to admin database by default', () => {
			return mongooseLib.connect().then((dbs) => {
				dbs.should.have.property('admin');
				dbs.admin.should.have.property('connection');
				dbs.admin.connection.name.should.eql(adminDatabaseName);
				dbs.admin.connection.readyState.should.eql(1);
			});
		});
	});

	describe('when given multiple databases', () => {
		let mongooseLib;
		const adminDatabaseName = 'mean-test-mongoose-admin';
		const otherDatabaseName = 'mean-test-mongoose-other';

		beforeEach(() => {
			mongooseLib = createSubjectUnderTest({
				admin: `mongodb://localhost/${adminDatabaseName}`,
				other: `mongodb://localhost/${otherDatabaseName}`
			});
		});

		afterEach(() => {
			return mongooseLib.disconnect();
		});

		it('connects to admin database by default', () => {
			return mongooseLib.connect().then((dbs) => {
				dbs.should.have.property('admin');
				dbs.admin.should.have.property('connection');
				dbs.admin.connection.name.should.eql(adminDatabaseName);
				dbs.admin.connection.readyState.should.eql(1);
			});
		});

		it('connects to other databases', () => {
			return mongooseLib.connect().then((dbs) => {
				dbs.should.have.property('other');
				dbs.other.name.should.eql(otherDatabaseName);
				return new Promise( (resolve) => {
					dbs.other.on('connected', resolve);
				});
			});
		});


	});


});
