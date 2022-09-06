/**
 * @param schema
 */
const textSearchPlugin = (schema) => {
	/**
	 * @param {string} search
	 * @param {boolean} [sortByTextScore]
	 * @returns {*}
	 */
	schema.query.textSearch = function (search, sortByTextScore = false) {
		if (null == search || '' === search) {
			return this;
		}

		const query = this.where({ $text: { $search: search } }).select({
			score: { $meta: 'textScore' }
		});

		if (sortByTextScore) {
			return query.sort({
				...this.getOptions().sort,
				score: { $meta: 'textScore' }
			});
		}
		return query;
	};
};

module.exports = textSearchPlugin;
