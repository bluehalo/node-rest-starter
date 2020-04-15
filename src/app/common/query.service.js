'use strict';

const _ = require('lodash'),
	q = require('q'),
	deps = require('../../dependencies'),
	config = deps.config;

function escapeRegex(str) {
	return (`${str}`).replace(/[.?*+^$[\]\\(){}|-]/g, '\\$&');
}

function generateFind(query) {
	let find;

	// If the query is non-null, add the query terms
	if(null != query){
		find = find || {};
		for(const k in query){
			find[k] = query[k];
		}
	}

	return find;
}

function generateSort(sortArr) {
	const sort = {};

	// If the sort is non-null, extract the sort instructions
	if(null != sortArr){
		sortArr.forEach((d) => {
			sort[d.property] = (d.direction === 'ASC')? 1 : -1;
		});
	}

	return sort;
}

function pagingQuery(schema, find, projection, options, sort, limit, offset, runCount, populate) {

	// Build the query
	const baseQuery = schema.find(find);
	let findQuery = schema.find(find, projection, options).sort(sort).skip(offset).limit(limit).maxTimeMS(config.maxTimeMS);

	// Add population
	if (populate) {
		findQuery = findQuery.populate(populate);
	}

	// Build the promise response
	const countDefer = q.defer();

	if (null == runCount)
		runCount = true;

	if (runCount) {
		baseQuery.countDocuments((error, results) => {
			if (null != error) {
				countDefer.reject(error);
			} else {
				countDefer.resolve(results);
			}
		});
	} else {
		countDefer.resolve(Number.MAX_SAFE_INTEGER);
	}
	const queryDefer = q.defer();
	findQuery.exec((error, results) => {
		if(null != error){
			queryDefer.reject(error);
		} else {
			queryDefer.resolve(results);
		}
	});

	const returnDefer = q.defer();
	q.all([countDefer.promise, queryDefer.promise]).then(([count, results]) => {
		const returnObj = {};
		if (null != count) {
			returnObj.count = count;
		}
		returnObj.results = results;
		returnDefer.resolve(returnObj);
	}, (error) => {
		returnDefer.reject(error);
	});

	return returnDefer.promise;
}

// Generic contains regex search
module.exports.containsQuery = function(schema, query, fields, search, limit, offset, sortArr, runCount) {
	// Initialize find to null
	let find = generateFind(query);
	const projection = {};
	const options = {};
	const sort = generateSort(sortArr);

	// Build the find
	if(null != search && '' !== search) {
		find = find || {};

		if(null != fields && fields.length > 1) {
			find.$or = [];

			fields.forEach((element) => {
				const constraint = {};
				constraint[element] = { $regex: new RegExp(escapeRegex(search), 'gim') };

				find.$or.push(constraint);
			});
		}
	}

	return pagingQuery(schema, find, projection, options, sort, limit, offset, runCount);
};

// Generic Full text search
module.exports.search = function(schema, query, searchTerms, limit, offset, sortArr, runCount, populate) {
	// Initialize find to null
	let find = generateFind(query);
	let projection;
	const options = {};
	const sort = generateSort(sortArr);

	// If the searchTerms is non-null, then build the text search
	if(null != searchTerms && '' !== searchTerms){
		find = find || {};
		find.$text = { $search: searchTerms };

		projection = projection || {};
		projection.score = { $meta: 'textScore' };

		// Sort by textScore last if there is a searchTerms
		sort.score = { $meta: 'textScore' };
	}

	return pagingQuery(schema, find, projection, options, sort, limit, offset, runCount, populate);
};

module.exports.stream = function(schema, query, searchTerms, limit, offset, sortArr, lean) {
	// Initialize find to null
	let find = generateFind(query);
	let projection;
	const options = {};
	const sort = generateSort(sortArr);


	// If the searchTerms is non-null, then build the text search
	if(null != searchTerms && '' !== searchTerms){
		find = find || {};
		find.$text = { $search: searchTerms };

		projection = projection || {};
		projection.score = { $meta: 'textScore' };

		// Sort by textScore last if there is a searchTerms
		sort.score = { $meta: 'textScore' };
	}

	return schema.find(find, projection, options).sort(sort).skip(offset).limit(limit).stream();
};

module.exports.count = function(schema, query) {
	const find = generateFind(query);

	// Build the query
	const baseQuery = schema.find(find);

	// Build the promise response
	const countDefer = q.defer();
	baseQuery.countDocuments((error, results) => {
		if(null != error){
			countDefer.reject(error);
		} else {
			countDefer.resolve(results);
		}
	});

	return countDefer.promise;
};

/**
 * Query for multiple documents by ID and get results as a map from id -> result.
 * @param schema
 * @param ids
 * @param fieldsToReturn Optional array of fields to include in results. If empty will include all fields.
 * @param lean If true, will return as plain javascript objects instead of mongoose docs
 * @returns {Promise}
 */
module.exports.getAllByIdAsMap = function(schema, ids, fieldsToReturn, lean) {
	fieldsToReturn = fieldsToReturn || [];

	const projection = {};
	fieldsToReturn.forEach((field) => {
		projection[field] = 1;
	});

	let promise = schema.find( { _id: { $in: ids } }, projection );
	if (lean) {
		promise = promise.lean();
	}

	return promise.then((results) => _.keyBy(results, (result) => result._id));
};

module.exports.mongooseToObject = function(doc) {
	if (doc.constructor.name === 'model') {
		return doc.toObject();
	}
	return doc;
};
