'use strict';

const
	_ = require('lodash'),
	q = require('q'),
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
	return q.all([
		CacheEntry.remove()
	]);
}

function cacheSpec(key) {
	return {
		key: key.toLowerCase(),
		value: {
			name: key + ' Name',
			organization: key + ' Organization',
			email: key + '@mail.com',
			username: key + '_username',
			roles: ['role1', 'role2'],
			groups: ['group1', 'group2']
		}
	};
}

function providerSpec(key) {
	return {
		name: key + ' Name',
		organization: key + ' Organization',
		email: key + '@mail.com',
		username: key + '_username',
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
describe('Access Checker Service:', function() {

	// Specs for tests
	let spec = { cache: {} };
	let provider = {};

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

	let cache = {};

	before(function() {
		return clearDatabase().then(function() {
			let defers = [];

			// Create the cache entries
			defers = defers.concat(_.keys(spec.cache).map(function(k) {
				return (new CacheEntry(spec.cache[k])).save().then(function(e) { cache[k] = e; });
			}));

			return q.all(defers);
		});
	});

	after(function() {
		return clearDatabase();
	});


	/**
	 * Test functionality with the access checker provider fails
	 */
	describe('Broken Access Checker', function() {

		before(function() {
			// All of the data is loaded, so initialize proxy-pki
			config.auth.accessChecker = {
				provider: {
					file: 'src/server/app/access-checker/providers/failure-provider.server.service.js',
					config: {}
				}
			};
		});

		// Provider fails on get
		it('should not update the cache when the access checker provider fails', function() {
			return accessChecker.get('provideronly').then(function(result) {
				should.fail('Fail provider should throw an error');
			}, function(err) {
				// Should have errored
				should.exist(err);

				return CacheEntry.findOne({ key: 'provideronly' }).exec()
					.then(function(result) {
						should.not.exist(result);
					});
			});
		});

		// Provider fails on refresh attempt
		it('should not update the cache on refresh when the access checker provider fails', function() {
			return accessChecker.refreshEntry(spec.cache.outdated.key).then(function(result) {
				should.fail('Fail provider should throw an error');
			}, function(err) {
				// Should have errored
				should.exist(err);

				// Query for the cache object and verify it hasn't been updated
				return CacheEntry.findOne({ _id: cache.outdated._id }).exec()
					.then(function(result) {
						validateCacheEntry(result.value, spec.cache.outdated.value);
					});

			});
		});

	});


	/**
	 * Test basic functionality of a working provider
	 */
	describe('Working Access Checker', function() {

		before(function() {
			// All of the data is loaded, so initialize proxy-pki
			config.auth.accessChecker = {
				provider: {
					file: 'src/server/app/access-checker/providers/example-provider.server.service.js',
					config: provider
				}
			};
		});

		// Pull from cache
		it('should do nothing when the key is null', function() {
			// should return the info from the cache
			return accessChecker.get(null).then(function(info) {
				should.fail('Should error when key is null');
			}, function(err) {
				should.exist(err);
			});
		});

		// Pull from cache
		it('should pull from cache when the entry is current and present', function() {
			// should return the info from the cache
			return accessChecker.get(spec.cache.good.key).then(function(info) {
				validateCacheEntry(info, spec.cache.good.value);
			});
		});

		// Pull from provider
		it('should pull from provider and update cache when entry is expired', function() {
			// should return the info from the provider
			return accessChecker.get(spec.cache.expired.key).then(function(info) {
				validateCacheEntry(info, provider.expired);

				return CacheEntry.findOne({ key: cache.expired.key }).exec()
					.then(function(result) {
						validateCacheEntry(result.value, provider.expired);
					});
			});
		});

		// Cache only
		it('should return the cache entry if the entry is missing from the provider', function() {
			// should return the info from the cache
			return accessChecker.get(spec.cache.cacheonly.key).then(function(info) {
				validateCacheEntry(info, spec.cache.cacheonly.value);

				return CacheEntry.findOne({ key: cache.cacheonly.key }).exec()
					.then(function(result) {
						validateCacheEntry(result.value, spec.cache.cacheonly.value);
					});
			});
		});

		// Provider only
		it('should update the cache when pulling from the provider', function() {
			// should return the info from the cache
			return accessChecker.get('provideronly').then(function(info) {
				validateCacheEntry(info, provider.provideronly);

				return CacheEntry.findOne({ key: 'provideronly' }).exec()
					.then(function(result) {
						validateCacheEntry(result.value, provider.provideronly);
					});
			});
		});
	});

});
