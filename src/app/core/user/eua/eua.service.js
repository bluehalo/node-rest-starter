const { dbs, utilService } = require('../../../../dependencies');

/**
 * Import types for reference below
 *
 * @typedef {import('mongoose').PopulateOptions} PopulateOptions
 * @typedef {import('./types').UserAgreementDocument} UserAgreementDocument
 * @typedef {import('./types').UserAgreementModel} UserAgreementModel
 * @typedef {import('../types').UserDocument} UserDocument
 */

class EuaService {
	constructor() {
		/**
		 * @type {UserAgreementModel}
		 */
		this.model = dbs.admin.model('UserAgreement');
	}

	/**
	 * @param obj
	 * @returns {Promise<UserAgreementDocument>}
	 */
	create(obj) {
		const document = new this.model(obj);
		return document.save();
	}

	/**
	 * @param {string} id
	 * @param {string | PopulateOptions | Array<string | PopulateOptions>} [populate]
	 * @returns {Promise<UserAgreementDocument | null>}
	 */
	read(id, populate = []) {
		return this.model
			.findById(id)
			.populate(/** @type {string} */ (populate))
			.exec();
	}

	/**
	 * @param {UserAgreementDocument} document The document to update
	 * @param {*} obj The obj with updated fields
	 * @returns {Promise<UserAgreementDocument>}
	 */
	update(document, obj) {
		// Copy over the new eua properties
		document.text = obj.text;
		document.title = obj.title;

		return document.save();
	}

	/**
	 * @param {UserAgreementDocument} document The document to delete
	 * @returns {Promise<UserAgreementDocument>}
	 */
	remove(document) {
		return document.remove();
	}

	/**
	 * @param [queryParams]
	 * @param {import('mongoose').FilterQuery<UserAgreementDocument>} [query]
	 * @param {string} [search]
	 * @returns {Promise<import('../../../common/mongoose/types').PagingResults<UserAgreementDocument>>}
	 */
	search(queryParams, query, search) {
		query = query || {};
		const page = utilService.getPage(queryParams);
		const limit = utilService.getLimit(queryParams);
		const sort = utilService.getSortObj(queryParams, 'DESC');

		return this.model
			.find(query)
			.textSearch(search)
			.sort(sort)
			.paginate(limit, page);
	}

	/**
	 * @param {UserAgreementDocument} document The eua to publish
	 * @returns {Promise<UserAgreementDocument | null>}
	 */
	publishEua(document) {
		document.published = Date.now();
		return document.save();
	}

	/**
	 * @returns {Promise<UserAgreementDocument | null>}
	 */
	getCurrentEua() {
		return this.model
			.findOne({ published: { $ne: null, $exists: true } })
			.sort({ published: -1 })
			.exec();
	}

	/**
	 * @param {UserDocument} user
	 * @returns {Promise<UserDocument | null>}
	 */
	acceptEua(user) {
		user.acceptedEua = Date.now();
		return user.save();
	}
}

module.exports = new EuaService();
