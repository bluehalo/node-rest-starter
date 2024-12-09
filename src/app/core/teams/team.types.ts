import { Type } from '@fastify/type-provider-typebox';

import { TeamRoles } from './team-role.model';
import { TeamType } from './team.model';
import { IdParamsType, ObjectIdType } from '../core.types';

export const CreateTeamType = Type.Object({
	team: Type.Pick(TeamType, [
		'name',
		'description',
		'implicitMembers',
		'requiresExternalRoles',
		'requiresExternalTeams',
		'parent'
	]),
	firstAdmin: Type.Optional(ObjectIdType)
});

export const UpdateTeamType = Type.Pick(CreateTeamType, [
	'name',
	'description',
	'requiresExternalRoles',
	'requiresExternalTeams'
]);

export const AddTeamMembersType = Type.Object({
	newMembers: Type.Array(
		Type.Object({
			_id: ObjectIdType,
			role: Type.Enum(TeamRoles)
		})
	)
});

export const TeamMemberRoleType = Type.Object({
	role: Type.Enum(TeamRoles)
});

export const RequestTeamType = Type.Object({
	org: Type.String(),
	aoi: Type.String(),
	description: Type.String()
});

export const IdAndMemberIdParamsType = Type.Composite([
	IdParamsType,
	Type.Object({
		memberId: Type.String()
	})
]);
