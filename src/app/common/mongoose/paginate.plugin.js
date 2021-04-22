const deps = require('../../../dependencies'),
	config = deps.config;

const MONGO_TIMEOUT_ERROR_CODE = 50;

/**
 * @typedef {Object} PagingResult
 * @property {number} pageSize
 * @property {number} pageNumber
 * @property {number} totalSize
 * @property {number} totalPages
 * @property {*[]} elements
 */

/**
 * @param schema
 */
const paginatePlugin = (schema) => {
	/**
	 * @param {number} pageSize
	 * @param {number} pageNumber
	 * @param {boolean} runCount
	 * @param {number} countTimeout
	 * @returns {Promise<PagingResult>}
	 */
	schema.query.paginate = async function (
		pageSize,
		pageNumber,
		runCount = true,
		countTimeout = config.maxCountTimeMS
	) {
		const countPromise = runCount
			? this.model
					.find(this.getFilter())
					.maxTimeMS(countTimeout)
					.countDocuments()
					.exec()
					.catch((err) => {
						// Hit timeout
						if (err.code === MONGO_TIMEOUT_ERROR_CODE) {
							return Promise.resolve(Number.MAX_SAFE_INTEGER);
						}
						return err;
					})
			: Promise.resolve(Number.MAX_SAFE_INTEGER);

		const resultsPromise = this.skip(pageNumber * pageSize)
			.limit(pageSize)
			.maxTimeMS(config.maxTimeMS)
			.exec();

		const [totalSize, elements] = await Promise.all([
			countPromise,
			resultsPromise
		]);
		if (totalSize === 0) {
			pageNumber = 0;
		}
		return {
			pageSize,
			pageNumber,
			totalSize,
			totalPages: Math.ceil(totalSize / pageSize),
			elements
		};
	};
};

module.exports = paginatePlugin;
