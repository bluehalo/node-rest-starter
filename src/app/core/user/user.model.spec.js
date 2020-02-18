'use strict';

const
	q = require('q'),
	should = require('should'),

	deps = require('../../../dependencies'),
	dbs = deps.dbs,

	User = dbs.admin.model('User');

/**
 * Globals
 */
function clearDatabase() {
	return q.all([
		User.remove()
	]);
}

function userSpec(key) {
	return {
		name: `${key} Name`,
		organization: `${key} Organization`,
		email: `${key}@mail.com`,
		username: `${key}_username`,
		password: 'password',
		provider: 'local'
	};
}


/**
 * Unit tests
 */
describe('User Model:', () => {
	before(() => {
		return clearDatabase();
	});

	after(() => {
		return clearDatabase();
	});


	describe('Method Save', () => {
		it('should begin with no users', () => {
			return User.find({}).exec()
				.then((result) => {
					should(result).be.an.Array();
					should(result).have.length(0);
				});
		});

		it('should be able to save a valid user', () => {
			const validUser = new User(userSpec('valid'));
			return validUser.save().then((result) => {
				should.exist(result);
			});
		});

		it('should result in 1 user', () => {
			return User.find({}).exec()
				.then((result) => {
					should(result).be.an.Array();
					should(result).have.length(1);
				});
		});

		it('should not be able to save with the same username', () => {
			const validUser = new User(userSpec('valid'));
			return validUser.save().then(() => {
				should.fail();
			}, (err) => {
				should.exist(err);
			});
		});

		// Testing missing fields
		['name', 'organization', 'email', 'username'].forEach((field) => {

			// Creating a test case for each field
			it(`should fail to save if missing field: '${field}'`, () => {
				const u = new User(userSpec(`missing_${field}`));
				u[field] = undefined;

				return u.save()
					.then(() => {
						should.fail();
					}, (err) => {
						should.exist(err);
					});
			});

		});

	});
});
