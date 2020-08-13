'use strict';

const deps = require('../../../dependencies'),
	util = deps.utilService,
	dbs = deps.dbs,
	User = dbs.admin.model('User');

/**
 * ==========================================================
 * Public Methods
 * ==========================================================
 */

const read = (id, populate = []) => {
	return User.findById(id).populate(populate).exec();
};

const update = (user) => {
	// Update the updated date
	user.updated = Date.now();

	return user.save();
};

const remove = (user) => {
	return user.remove();
};

const searchUsers = async (queryParams, query, search, searchFields = []) => {
	query = query || {};
	const page = util.getPage(queryParams);
	const limit = util.getLimit(queryParams);
	const sortArr = util.getSort(queryParams,'DESC');
	const offset = page * limit;

	let result;
	if (searchFields.length > 0) {
		result = await User.containsSearch(query, searchFields, search, limit, offset, sortArr);
	} else {
		result = await User.textSearch(query, search, limit, offset, sortArr);
	}

	return util.getPagingResults(limit, page, result.count, result.results);
};

module.exports = {
	read,
	update,
	remove,
	searchUsers
};
