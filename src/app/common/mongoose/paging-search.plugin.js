const
	deps = require('../../../dependencies'),
	config = deps.config;

const MONGO_TIMEOUT_ERROR_CODE = 50;

function escapeRegex(str) {
	return (`${str}`).replace(/[.?*+^$[\]\\(){}|-]/g, '\\$&');
}

function generateFilter(query) {
	return Object.assign({}, query);
}

function generateSort(sortArr) {
	return (sortArr || []).reduce((sort, element) => {
		sort[element.property] = (element.direction === 'ASC') ? 1 : -1;
		return sort;
	}, {});
}

const pagingQuery = async (schema, filter, projection, options, sort, limit, offset, runCount = true, populate = [], countTimeout = config.maxCountTimeMS) => {
	// Build the queries
	const countQuery = schema.find(filter).maxTimeMS(countTimeout);
	const resultsQuery = schema.find(filter, projection, options).sort(sort).skip(offset).limit(limit).maxTimeMS(config.maxTimeMS).populate(populate);

	const countPromise = runCount ?
							countQuery.countDocuments().exec()
										.catch((err) => {
												// Hit timeout
												if(err.code === MONGO_TIMEOUT_ERROR_CODE) {
													return Promise.resolve(Number.MAX_SAFE_INTEGER);
												}
												else {
													return err;
												}
											}) : Promise.resolve(Number.MAX_SAFE_INTEGER);
	const resultsPromise = resultsQuery.exec();

	const [count, results] = await Promise.all([countPromise, resultsPromise]);

	return { results, count };
};

// Generic contains regex search
const searchContainsQuery = (schema, query, fields, search, limit, offset, sortArr, runCount, countTimeout) => {
	const filter = generateFilter(query);
	const sort = generateSort(sortArr);
	const projection = {};
	const options = {};

	// Add search to the filter
	if (null != search && '' !== search) {
		if (null != fields && fields.length > 0) {
			filter.$or = fields.map((element) => {
				const constraint = {};
				constraint[element] = { $regex: new RegExp(escapeRegex(search), 'gim') };
				return constraint;
			});
		}
	}

	return pagingQuery(schema, filter, projection, options, sort, limit, offset, runCount, countTimeout);
};

// Generic Full text search
const searchTextQuery = (schema, query, search, limit, offset, sortArr, runCount, populate, countTimeout) => {
	const filter = generateFilter(query);
	const sort = generateSort(sortArr);
	const projection = {};
	const options = {};

	// Add text search to the filter
	if (null != search && '' !== search) {
		filter.$text = { $search: search };

		projection.score = { $meta: 'textScore' };

		// Sort by textScore last if there is a searchTerms
		sort.score = { $meta: 'textScore' };
	}

	return pagingQuery(schema, filter, projection, options, sort, limit, offset, runCount, populate, countTimeout);
};

function pagingSearchPlugin(schema, options) {
	// Search by text and other criteria
	schema.statics.textSearch = function (queryTerms, searchTerms, limit, offset, sortArr, runCount, populate, countTimeout) {
		return searchTextQuery(this, queryTerms, searchTerms, limit, offset, sortArr, runCount, populate, countTimeout);
	};

	// Find using a contains/wildcard regex on a fixed set of fields
	schema.statics.containsSearch = function (queryTerms, fields, search, limit, offset, sortArr, runCount, countTimeout) {
		return searchContainsQuery(this, queryTerms, fields, search, limit, offset, sortArr, runCount, countTimeout);
	};
}

module.exports = pagingSearchPlugin;
