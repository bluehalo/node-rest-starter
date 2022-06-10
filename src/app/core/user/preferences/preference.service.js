'use strict';

const deps = require('../../../../dependencies'),
	util = deps.utilService,
	dbs = deps.dbs,
	Preference = dbs.admin.model('Preference');

module.exports.searchAll = function (query, populate = []) {
	return Preference.find(query).populate(populate).exec();
};

module.exports.search = (query, queryParams) => {
	query = query ?? {};
	const page = util.getPage(queryParams);
	const limit = util.getLimit(queryParams, 1000);
	const sort = util.getSortObj(queryParams);

	return Preference.find(query).sort(sort).paginate(limit, page);
};
