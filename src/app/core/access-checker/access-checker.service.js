'use strict';

const
	_ = require('lodash'),
	path = require('path'),
	q = require('q'),

	deps = require('../../../dependencies'),
	config = deps.config,
	dbs = deps.dbs,

	CacheEntry = dbs.admin.model('CacheEntry');



function getConfig() {
	let acConfig = (null != config.auth && null != config.auth.accessChecker)? config.auth.accessChecker : {};
	if(null == acConfig.cacheExpire) acConfig.cacheExpire = 1000*60*60*24;
	return acConfig;
}

function getProvider() {
	let provider;
	let acConfig = getConfig();

	if(null != acConfig.provider) {
		provider = require(path.posix.resolve(acConfig.provider.file))(acConfig.provider.config);
	}

	return provider;
}

/**
 * Put the entry in the cache
 * @param id The unique identifier for the entry
 * @param value The entry info object
 */
function saveToCache(id, value) {
	let defer = q.defer();

	// Convert the value to a string that's searchable
	let valueString;

	if(_.isFunction(value)) {
		valueString = '';
	}
	else if(_.isArray(value) || _.isObject(value)) {
		valueString = JSON.stringify(value);
	}
	else {
		valueString = '' + value;
	}

	// Upsert the cache entry
	CacheEntry.findOneAndUpdate({ key: id }, { value: value, valueString: valueString, ts: Date.now() }, { new: true, upsert: true },
		function(err, result) {
			if(null != err) {
				defer.reject(err);
			}
			else {
				defer.resolve(result);
			}
		}
	);

	return defer.promise;
}

/**
 * Delete the entry in the cache
 * @param id The unique identifier for the entry
 */
function deleteFromCache(id) {
	let defer = q.defer();

	// Upsert the cache entry
	CacheEntry.findOneAndRemove({ key: id },
		function(err, result) {
			if(null != err) {
				defer.reject(err);
			}
			else {
				defer.resolve(result);
			}
		}
	);

	return defer.promise;
}

/**
 * Get the entry from the cache. Gets the most recent version.
 * @param id The unique identifier for the entry to get
 * @returns The retrieved cache value
 */
function getFromCache(id) {
	let defer = q.defer();

	CacheEntry.findOne({ key: id }).sort({ ts: -1 }).exec(function(err, result) {
		if (null != err) {
			defer.reject(err);
		} else {
			defer.resolve(result);
		}
	});

	return defer.promise;
}


/**
 * Get the entry. Tries to get the entry from the cache, if not
 * found, gets the entry from the access checker provider
 */
module.exports.get = function (id) {
	let defer = q.defer();

	if(null == id) {
		return q.reject('id cannot be null or undefined');
	}

	getFromCache(id).then(function(result) {
		// If the result is in the cache (and not expired), use it
		if (null != result && (Date.now() - result.ts < getConfig().cacheExpire)) {
			// The result is in the cache, so use it
			defer.resolve(result.value);
		}
		// If it isn't in the cache or it's expired, get it from the provider
		else {

			try {
				let provider = getProvider();
				if(null == provider) {
					return defer.reject('No accessChecker provider configuration found.');
				}

				// No result was found, so query access provider for it
				q(provider.get(id)).then(function(result) {
					// Store it in the cache
					saveToCache(id, result).then(function(cacheEntry) {
						// Return the saved value if possible
						defer.resolve((null != cacheEntry && null != cacheEntry.value)? cacheEntry.value : result);
					}, function(err) {
						// To avoid failures, we will return the result even if the save to cache fails
						defer.resolve(result);
					});
				}, defer.reject).done();
			} catch(ex) {
				defer.reject('Error from access checker provider' + ex);
			}
		}
	}, defer.reject);

	return defer.promise;
};

/**
 * Get the entry from the access checker provider and update the cache
 */
module.exports.refreshEntry = function(id) {
	let defer = q.defer();

	if(null == id) {
		return q.reject('id cannot be null or undefined');
	}

	let provider = getProvider();
	if(null == provider) {
		defer.reject('No accessChecker provider configuration found.');
	} else {
		try {
			// Hit the provider for the id
			q(provider.get(id)).then(function(result) {
				// Store it in the cache if it was found
				saveToCache(id, result).then(defer.resolve, defer.reject);
			}, defer.reject).done();
		} catch(ex) {
			defer.reject('Error from the access checker provider: ' + ex);
		}
	}

	return defer.promise;
};

/**
 * Delete the entry from the cache
 * @param id
 */
module.exports.deleteEntry = function(id) {
	return deleteFromCache(id);
};
