/**
 * @param schema
 */
const textSearchPlugin = (schema) => {
	/**
	 * @param {string} search
	 * @returns {*}
	 */
	schema.query.textSearch = function (search) {
		if (null == search || '' === search) {
			return this;
		}

		return this.where({ $text: { $search: search } })
			.select({
				score: { $meta: 'textScore' }
			})
			.sort({ ...this.getOptions().sort, score: { $meta: 'textScore' } });
	};
};

module.exports = textSearchPlugin;
