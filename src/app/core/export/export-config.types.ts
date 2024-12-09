import { Type } from '@fastify/type-provider-typebox';

import { DirectionType } from '../core.types';

export const ExportConfigType = Type.Object({
	type: Type.String(),
	config: Type.Object({
		cols: Type.Array(
			Type.Object({
				key: Type.String(),
				title: Type.Optional(Type.String())
			})
		),
		s: Type.String(),
		q: Type.Object({}, { additionalProperties: true }),
		sort: Type.String(),
		dir: DirectionType
	})
});
