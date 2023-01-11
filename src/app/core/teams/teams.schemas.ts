import JSONSchema7 from 'json-schema';

export const addMembers: JSONSchema7.JSONSchema7Object = {
	$schema: 'http://json-schema.org/draft-07/schema',
	$id: 'moniker-rest-server/src/app/core/team/addMembers',
	type: 'object',
	title: 'Team Add Members Schema',
	description: 'Schema for adding members to a team',
	required: ['newMembers'],
	properties: {
		newMembers: {
			$id: '#/properties/newMembers',
			type: 'array',
			title: 'Type',
			description: 'type of the export request',
			items: {
				type: 'object',
				required: ['_id', 'role'],
				properties: {
					_id: {
						type: 'string'
					},
					role: {
						type: 'string'
					}
				}
			},
			minItems: 1
		}
	}
};
