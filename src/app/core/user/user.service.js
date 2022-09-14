'use strict';

const { dbs, utilService } = require('../../../dependencies');

/**
 * Import types for reference below
 * @typedef {import('mongoose').PopulateOptions} PopulateOptions
 * @typedef {import('./types').UserDocument} UserDocument
 * @typedef {import('./types').UserModel} UserModel
 */

class UserService {
	constructor() {
		/**
		 * @type {UserModel}
		 */
		this.model = dbs.admin.model('User');
	}

	/**
	 * @param {string} id
	 * @param {string | PopulateOptions | Array<string | PopulateOptions>} [populate]
	 * @returns {Promise<UserDocument | null>}
	 */
	read(id, populate = []) {
		return this.model
			.findById(id)
			.populate(/** @type {string} */ (populate))
			.exec();
	}

	/**
	 * @param {UserDocument} document The document to update
	 * @param {*} obj The obj with updated fields
	 * @returns {Promise<UserDocument>}
	 */
	update(document, obj = {}) {
		document.set(obj);

		// Update the updated date
		document.updated = Date.now();
		return document.save();
	}

	/**
	 * @param {UserDocument} document The document to delete
	 * @returns {Promise<UserDocument>}
	 */
	remove(document) {
		return document.remove();
	}

	/**
	 * @param queryParams
	 * @param {import('mongoose').FilterQuery<UserDocument>} query
	 * @param {string} search
	 * @param {string[]} searchFields
	 * @returns {Promise<import('../../common/mongoose/paginate.plugin').PagingResults<UserDocument>>}
	 */
	searchUsers(queryParams, query, search, searchFields = []) {
		query = query || {};
		const page = utilService.getPage(queryParams);
		const limit = utilService.getLimit(queryParams);
		const sort = utilService.getSortObj(queryParams, 'DESC');

		let mQuery = this.model.find(query);

		if (searchFields.length > 0) {
			mQuery = mQuery.containsSearch(search, searchFields);
		} else {
			mQuery = mQuery.textSearch(search);
		}

		return mQuery.sort(sort).paginate(limit, page);
	}

	/**
	 * @param {UserDocument} document The user to edit
	 * @returns {Promise<UserDocument>}
	 */
	updateLastLogin(document) {
		document.lastLogin = Date.now();
		return document.save();
	}

	/**
	 * @param {UserDocument} document The user to edit
	 * @returns {Promise<UserDocument>}
	 */
	updateLastLoginWithAccess(document) {
		document.lastLoginWithAccess = Date.now();
		return document.save();
	}
}

module.exports = new UserService();
