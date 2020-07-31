'use strict';

const
	_ = require('lodash'),
	should = require('should'),

	deps = require('../../../dependencies'),
	config = deps.config,
	dbs = deps.dbs,

	CacheEntry = dbs.admin.model('CacheEntry'),
	accessChecker = require('./access-checker.service');


/**
 * Helpers
 */
function clearDatabase() {
	return Promise.all([
		CacheEntry.deleteMany({})
	]);
}

function cacheSpec(key) {
	return {
		key: key.toLowerCase(),
		value: {
			name: `${key} Name`,
			organization: `${key} Organization`,
			email: `${key}@mail.com`,
			username: `${key}_username`,
			roles: ['role1', 'role2'],
			groups: ['group1', 'group2']
		}
	};
}

function providerSpec(key) {
	return {
		name: `${key} Name`,
		organization: `${key} Organization`,
		email: `${key}@mail.com`,
		username: `${key}_username`,
		roles: ['role1', 'role2'],
		groups: ['group1', 'group2']
	};
}

function validateCacheEntry(actual, expected) {
	should.exist(actual);
	should(actual.name).equal(expected.name);
	should(actual.organization).equal(expected.organization);
	should(actual.email).equal(expected.email);
	should(actual.username).equal(expected.username);

	should(actual.roles).be.an.Array();
	should(actual.roles).have.length(expected.roles.length);
	should(actual.roles).containDeep(expected.roles);

	should(actual.groups).be.an.Array();
	should(actual.groups).have.length(expected.groups.length);
	should(actual.groups).containDeep(expected.groups);
}

/**
 * Unit tests
 */
describe('Access Checker Service:', () => {

	// Specs for tests
	const spec = { cache: {} };
	const provider = {};

	// Cache and provider agree, entry is current
	spec.cache.good = cacheSpec('good');
	provider.good = providerSpec('good');

	// Cache and provider disagree, entry is expired
	spec.cache.expired = cacheSpec('expired');
	spec.cache.expired.ts = Date.now() - 1000*60*60*24*10;
	provider.expired = providerSpec('expirednew');

	// Cache and provider disagree, entry id not expired
	spec.cache.outdated = cacheSpec('outdated');
	spec.cache.outdated.ts = Date.now() - 1000*60*60*24*10;
	provider.outdated = providerSpec('outdatednew');

	// Cache has entry that is now missing from provider
	spec.cache.cacheonly = cacheSpec('cacheonly');

	// Entry is only in the provider
	provider.provideronly = providerSpec('provideronly');

	const cache = {};

	before(() => {
		return clearDatabase().then(() => {
			let defers = [];

			// Create the cache entries
			defers = defers.concat(_.keys(spec.cache).map((k) => {
				return (new CacheEntry(spec.cache[k])).save().then((e) => { cache[k] = e; });
			}));

			return Promise.all(defers);
		});
	});

	after(() => {
		return clearDatabase();
	});


	/**
	 * Test functionality with the access checker provider fails
	 */
	describe('Broken Access Checker', () => {

		before(() => {
			// All of the data is loaded, so initialize proxy-pki
			config.auth.accessChecker = {
				provider: {
					file: 'src/app/core/access-checker/providers/failure-provider.service.js',
					config: {}
				}
			};
		});

		// Provider fails on get
		it('should not update the cache when the access checker provider fails', () => {
			return accessChecker.get('provideronly').then((result) => {
				should.fail('Fail provider should throw an error');
			}).catch((err) => {
				// Should have errored
				should.exist(err);

				return CacheEntry.findOne({ key: 'provideronly' }).exec()
					.then((result) => {
						should.not.exist(result);
					});
			});
		});

		// Provider fails on refresh attempt
		it('should not update the cache on refresh when the access checker provider fails', () => {
			return accessChecker.refreshEntry(spec.cache.outdated.key).then((result) => {
				should.fail('Fail provider should throw an error');
			}).catch((err) => {
				// Should have errored
				should.exist(err);

				// Query for the cache object and verify it hasn't been updated
				return CacheEntry.findOne({ _id: cache.outdated._id }).exec()
					.then((result) => {
						validateCacheEntry(result.value, spec.cache.outdated.value);
					});

			});
		});

	});


	/**
	 * Test basic functionality of a working provider
	 */
	describe('Working Access Checker', () => {

		before(() => {
			// All of the data is loaded, so initialize proxy-pki
			config.auth.accessChecker = {
				provider: {
					file: 'src/app/core/access-checker/providers/example-provider.service.js',
					config: provider
				}
			};
		});

		// Pull from cache
		it('should do nothing when the key is null', () => {
			// should return the info from the cache
			return accessChecker.get(null).then((info) => {
				should.fail('Should error when key is null');
			}).catch((err) => {
				should.exist(err);
			});
		});

		// Pull from cache
		it('should pull from cache when the entry is current and present', () => {
			// should return the info from the cache
			return accessChecker.get(spec.cache.good.key).then((info) => {
				validateCacheEntry(info, spec.cache.good.value);
			});
		});

		// Pull from provider
		it('should pull from provider and update cache when entry is expired', () => {
			// should return the info from the provider
			return accessChecker.get(spec.cache.expired.key).then((info) => {
				validateCacheEntry(info, provider.expired);

				return CacheEntry.findOne({ key: cache.expired.key }).exec()
					.then((result) => {
						validateCacheEntry(result.value, provider.expired);
					});
			});
		});

		// Cache only
		it('should return the cache entry if the entry is missing from the provider', () => {
			// should return the info from the cache
			return accessChecker.get(spec.cache.cacheonly.key).then((info) => {
				validateCacheEntry(info, spec.cache.cacheonly.value);

				return CacheEntry.findOne({ key: cache.cacheonly.key }).exec()
					.then((result) => {
						validateCacheEntry(result.value, spec.cache.cacheonly.value);
					});
			});
		});

		// Provider only
		it('should update the cache when pulling from the provider', () => {
			// should return the info from the cache
			return accessChecker.get('provideronly').then((info) => {
				validateCacheEntry(info, provider.provideronly);

				return CacheEntry.findOne({ key: 'provideronly' }).exec()
					.then((result) => {
						validateCacheEntry(result.value, provider.provideronly);
					});
			});
		});

		// Refresh cache entry
		it('should refresh the cache when forced', async () => {
			// should return the info from the cache
			await accessChecker.refreshEntry('provideronly');

			const result = await CacheEntry.findOne({ key: 'provideronly' }).exec();

			validateCacheEntry(result.value, provider.provideronly);
		});
	});

});
