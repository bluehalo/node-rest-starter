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

const searchUsers = (queryParams, query, search, searchFields = []) => {
	query = query || {};
	const page = util.getPage(queryParams);
	const limit = util.getLimit(queryParams);
	const sort = util.getSortObj(queryParams, 'DESC');

	let mQuery = User.find(query);

	if (searchFields.length > 0) {
		mQuery = mQuery.containsSearch(search, searchFields);
	} else {
		mQuery = mQuery.textSearch(search);
	}

	return mQuery.sort(sort).paginate(limit, page);
};

const updateLastLogin = (user) => {
	user.lastLogin = Date.now();
	return user.save();
};

module.exports = {
	read,
	update,
	remove,
	searchUsers,
	updateLastLogin
};
