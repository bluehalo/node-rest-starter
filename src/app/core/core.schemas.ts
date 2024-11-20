export const SearchBodySchema = {
	type: 'object',
	properties: {
		s: {
			type: 'string',
			description: 'Optional value to search against selected fields.'
		},
		q: {
			type: 'object',
			description:
				'Structured search object for matching database records. Typically supports MongoDB queries.'
		}
	},
	description: 'Criteria used for searching records'
} as const;

export const PagingQueryStringSchema = {
	type: 'object',
	properties: {
		page: { type: 'integer', description: 'Page number', examples: [0] },
		size: {
			type: 'integer',
			description: 'Number of results to return (results per page)',
			examples: [20]
		},
		sort: { type: 'string', description: 'Field name to sort by' },
		dir: {
			anyOf: [
				{ type: 'string', enum: ['ASC', 'DESC'] },
				{ type: 'integer', enum: [-1, 1] }
			],
			description: 'Sort direction'
		}
	}
} as const;
