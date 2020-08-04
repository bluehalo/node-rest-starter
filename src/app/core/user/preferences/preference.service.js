'use strict';

const deps = require('../../../../dependencies'),
	util = deps.utilService,
	dbs = deps.dbs,

	Preference = dbs.admin.model('Preference');


function doSearch(query, sortParams, page, limit) {
	const countPromise = Preference.find(query).countDocuments();
	let searchPromise = Preference.find(query);

	if (sortParams) {
		searchPromise = searchPromise.sort(sortParams);
	}

	if (limit) {
		searchPromise = searchPromise.skip(page * limit).limit(limit);
	}

	return Promise.all([ countPromise.exec(), searchPromise.exec() ])
		.then(([countResult, searchResult]) => {
			return util.getPagingResults(limit, page, countResult, searchResult);
		});
}

module.exports.searchAll = function(query) {
	return Preference.find(query).exec();
};

module.exports.search = function(query, queryParams) {
	const page = util.getPage(queryParams);
	const limit = util.getLimit(queryParams, 1000);

	const sort = queryParams.sort;
	let dir = queryParams.dir;

	// Sort can be null, but if it's non-null, dir defaults to DESC
	if (sort && !dir) { dir = 'ASC'; }

	let sortParams;
	if (sort) {
		sortParams = {};
		sortParams[sort] = dir === 'ASC' ? 1 : -1;
	}

	return doSearch(query, sortParams, page, limit);
};
