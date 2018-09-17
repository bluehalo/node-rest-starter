'use strict';

const _ = require('lodash'),
	q = require('q'),
	deps = require('../../dependencies'),
	config = deps.config;

function escapeRegex(str) {
	return (str+'').replace(/[.?*+^$[\]\\(){}|-]/g, '\\$&');
}

function generateFind(query) {
	let find;

	// If the query is non-null, add the query terms
	if(null != query){
		find = find || {};
		for(let k in query){
			find[k] = query[k];
		}
	}

	return find;
}

function generateSort(sortArr) {
	let sort = {};

	// If the sort is non-null, extract the sort instructions
	if(null != sortArr){
		sortArr.forEach(function(d){
			sort[d.property] = (d.direction === 'ASC')? 1 : -1;
		});
	}

	return sort;
}

function pagingQuery(schema, find, projection, options, sort, limit, offset, runCount) {

	// Build the query
	let baseQuery = schema.find(find);
	let findQuery = schema.find(find, projection, options).sort(sort).skip(offset).limit(limit).maxscan(config.maxScan);

	// Build the promise response
	let countDefer = q.defer();

	if (null == runCount)
		runCount = true;

	if (runCount) {
		baseQuery.count(function (error, results) {
			if (null != error) {
				countDefer.reject(error);
			} else {
				countDefer.resolve(results);
			}
		});
	} else {
		countDefer.resolve(Number.MAX_SAFE_INTEGER);
	}
	let queryDefer = q.defer();
	findQuery.exec(function(error, results){
		if(null != error){
			queryDefer.reject(error);
		} else {
			queryDefer.resolve(results);
		}
	});

	let returnDefer = q.defer();
	q.all([countDefer.promise, queryDefer.promise]).then(function(results){
		let returnObj = {};
		if (null != results[0]) {
			returnObj.count = results[0];
		}
		returnObj.results = results[1];
		returnDefer.resolve(returnObj);
	}, function(error){
		returnDefer.reject(error);
	});

	return returnDefer.promise;
}

// Generic contains regex search
module.exports.containsQuery = function(schema, query, fields, search, limit, offset, sortArr, runCount) {
	// Initialize find to null
	let find = generateFind(query);
	let projection = {};
	let options = {};
	let sort = generateSort(sortArr);

	// Build the find
	if(null != search && '' !== search) {
		find = find || {};

		if(null != fields && fields.length > 1) {
			find.$or = [];

			fields.forEach(function(element){
				let constraint = {};
				constraint[element] = { $regex: new RegExp(escapeRegex(search), 'gim') };

				find.$or.push(constraint);
			});
		}
	}

	return pagingQuery(schema, find, projection, options, sort, limit, offset, runCount);
};

// Generic Full text search
module.exports.search = function(schema, query, searchTerms, limit, offset, sortArr, runCount) {
	// Initialize find to null
	let find = generateFind(query);
	let projection;
	let options = {};
	let sort = generateSort(sortArr);

	// If the searchTerms is non-null, then build the text search
	if(null != searchTerms && '' !== searchTerms){
		find = find || {};
		find.$text = { $search: searchTerms };

		projection = projection || {};
		projection.score = { $meta: 'textScore' };

		// Sort by textScore last if there is a searchTerms
		sort.score = { $meta: 'textScore' };
	}

	return pagingQuery(schema, find, projection, options, sort, limit, offset, runCount);
};

module.exports.stream = function(schema, query, searchTerms, limit, offset, sortArr, lean) {
	// Initialize find to null
	let find = generateFind(query);
	let projection;
	let options = {};
	let sort = generateSort(sortArr);


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
	let find = generateFind(query);

	// Build the query
	let baseQuery = schema.find(find);

	// Build the promise response
	let countDefer = q.defer();
	baseQuery.count(function(error, results){
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

	let projection = {};
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
