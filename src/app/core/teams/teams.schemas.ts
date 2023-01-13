import JSONSchema7 from 'json-schema';

import { TeamRoles } from './team-role.model';

export const addMembers: JSONSchema7.JSONSchema7Object = {
	$schema: 'http://json-schema.org/draft-07/schema',
	$id: 'node-rest-server/src/app/core/team/addMembers',
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
						type: 'string',
						enum: Object.values(TeamRoles)
					}
				}
			},
			minItems: 1
		}
	}
};

export const addUpdateMemberRole: JSONSchema7.JSONSchema7Object = {
	$schema: 'http://json-schema.org/draft-07/schema',
	$id: 'node-rest-server/src/app/core/team/addUpdateMemberRole',
	type: 'object',
	title: 'Team Add/Update Member Role Schema',
	description: 'Schema for adding or updating a members role to a team',
	required: ['role'],
	properties: {
		role: {
			type: 'string',
			enum: Object.values(TeamRoles)
		}
	}
};
