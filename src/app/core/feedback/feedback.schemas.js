/**
 * @type {import('json-schema').JSONSchema7}
 */
module.exports.create = {
	$schema: 'http://json-schema.org/draft-07/schema',
	$id: 'node-rest-server/src/app/core/feedback/create',
	type: 'object',
	title: 'Feedback Schema',
	description: 'Schema for feedback creation',
	required: ['body', 'type', 'url'],
	properties: {
		body: {
			$id: '#/properties/body',
			type: 'string',
			title: 'Body',
			description: 'Body of the feedback',
			default: '',
			examples: ['This application is great!']
		},
		type: {
			$id: '#/properties/type',
			type: 'string',
			title: 'Type',
			description: 'type/category of the feedback',
			default: '',
			examples: ['general feedback']
		},
		url: {
			$id: '#/properties/url',
			type: 'string',
			title: 'URL',
			description: 'url from which the feedback was submitted',
			default: '',
			examples: ['http://localhost/#/home']
		},
		classification: {
			$id: '#/properties/classification',
			type: 'string',
			title: 'Classification',
			description: 'Classification level of the feedback',
			default: '',
			examples: ['class1']
		}
	}
};
