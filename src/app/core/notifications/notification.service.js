'use strict';

const
	q = require('q'),

	deps = require('../../../dependencies'),
	util = deps.utilService,
	dbs = deps.dbs,

	Notification = dbs.admin.model('Notification');

function doSearch(query, sortParams, page, limit) {
	const countPromise = Notification.find(query).countDocuments();
	let searchPromise = Notification.find(query);

	if (sortParams) {
		searchPromise = searchPromise.sort(sortParams);
	}

	if (limit) {
		searchPromise = searchPromise.skip(page * limit).limit(limit);
	}

	return q.all([ countPromise, searchPromise ])
		.then(([countResult, searchResult]) => {
			return q(util.getPagingResults(limit, page, countResult, searchResult));
		});
}

module.exports.searchAll = function(query) {
	return Notification.find(query).exec();
};


module.exports.search = function(query, queryParams, user) {
	if (!user || !user._id) {
		return q.reject('Notification Service: user._id must be defined');
	}

	if (!query) {
		query = {};
	}

	// Always need to filter by user making the service call
	query.user = user._id;

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
