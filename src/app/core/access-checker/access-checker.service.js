'use strict';

const
	_ = require('lodash'),
	path = require('path'),

	deps = require('../../../dependencies'),
	config = deps.config,
	dbs = deps.dbs,

	CacheEntry = dbs.admin.model('CacheEntry');



function getConfig() {
	const acConfig = (null != config.auth && null != config.auth.accessChecker)? config.auth.accessChecker : {};
	if(null == acConfig.cacheExpire) acConfig.cacheExpire = 1000*60*60*24;
	return acConfig;
}

function getProvider() {
	let provider;
	const acConfig = getConfig();

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
const saveToCache = (id, value) => {

	// Convert the value to a string that's searchable
	let valueString;

	if(_.isFunction(value)) {
		valueString = '';
	}
	else if(_.isArray(value) || _.isObject(value)) {
		valueString = JSON.stringify(value);
	}
	else {
		valueString = `${value}`;
	}

	// Upsert the cache entry
	return CacheEntry.findOneAndUpdate({ key: id }, { value: value, valueString: valueString, ts: Date.now() }, { new: true, upsert: true }).exec();

};

/**
 * Delete the entry in the cache
 * @param id The unique identifier for the entry
 */
const deleteFromCache = (id) => CacheEntry.findOneAndRemove({ key: id }).exec();

/**
 * Get the entry from the cache. Gets the most recent version.
 * @param id The unique identifier for the entry to get
 * @returns The retrieved cache value
 */
const getFromCache = (id) => CacheEntry.findOne({ key: id }).sort({ ts: -1 }).exec();


/**
 * Get the entry. Tries to get the entry from the cache, if not
 * found, gets the entry from the access checker provider
 */
module.exports.get = async (id) => {

	if(null == id) {
		return Promise.reject('id cannot be null or undefined');
	}

	const result = await getFromCache(id);

	// If the result is in the cache (and not expired), use it
	if (null != result && (Date.now() - result.ts < getConfig().cacheExpire)) {
		// The result is in the cache, so use it
		return result.value;
	}

	// If it isn't in the cache or it's expired, get it from the provider
	try {
		const provider = getProvider();
		if(null == provider) {
			return Promise.reject('No accessChecker provider configuration found.');
		}

		// No result was found, so query access provider for it
		const _result = await provider.get(id);
		try {
			// Store it in the cache
			const cacheEntry = await saveToCache(id, _result);
			// Return the saved value if possible
			return (null != cacheEntry && null != cacheEntry.value) ? cacheEntry.value : _result;
		} catch(err) {
			// Failures saving to the cache are not critical,
			// so ignore them and return the result.
			return _result;
		}
	} catch(ex) {
		return Promise.reject(`Error getting from the access checker provider: ${ex}`);
	}
};

/**
 * Get the entry from the access checker provider and update the cache
 */
module.exports.refreshEntry = async (id) => {

	if(null == id) {
		return Promise.reject('id cannot be null or undefined');
	}

	const provider = getProvider();
	if(null == provider) {
		return Promise.reject('No accessChecker provider configuration found.');
	}

	try {
		// Hit the provider for the id
		const result = await provider.get(id);
		// Store it in the cache if it was found
		return saveToCache(id, result);
	} catch(ex) {
		return Promise.reject(`Error refreshing from the access checker provider: ${ex}`);
	}
};

/**
 * Delete the entry from the cache
 * @param id
 */
module.exports.deleteEntry = function(id) {
	return deleteFromCache(id);
};
