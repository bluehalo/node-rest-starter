'use strict';

const
	mongoose = require('mongoose'),

	deps = require('../../../dependencies'),
	dbs = deps.dbs,

	Owner = dbs.admin.model('Owner'),
	Resource = dbs.admin.model('Resource');

/**
 * Globals
 */
function clearDatabase() {
	return Promise.all([
		Resource.deleteMany({}),
		Owner.deleteMany({})
	]);
}

let owner1;
let resource1;

const spec = {
	resource1: {
		title: 'Title'
	},
	owner1: {
		type: 'team',
		_id: new mongoose.Types.ObjectId()
	}
};

/**
 * Unit tests
 */
describe('Resource Model:', () => {
	before(() => {
		return clearDatabase().then(() => {
			resource1 = new Resource(spec.resource1);
			owner1 = new Owner(spec.owner1);
		});
	});

	after(() => {
		return clearDatabase();
	});

	describe('Method Save', () => {
		it('should begin with no resources', () => {
			return Resource.find({}).then((resources) => {
				resources.should.have.length(0);
			});
		});

		it('should be able to save resource without problems', () => {
			resource1.owner = owner1;
			return resource1.save().should.be.fulfilled();
		});

		it('should have one resource', () => {
			return Resource.find({}).then((resources) => {
				resources.should.have.length(1);
			});
		});

		it('should fail when trying to save without a title', () => {
			resource1.title = '';
			resource1.owner = owner1;
			return resource1.save().should.be.rejected();
		});

		it('should fail when trying to save without an owner', () => {
			resource1.title = '';
			resource1.owner = null;
			return resource1.save().should.be.rejected();
		});

	});

});
