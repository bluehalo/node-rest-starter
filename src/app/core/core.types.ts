import { TSchema, Type } from '@fastify/type-provider-typebox';
import { Types as MongooseTypes } from 'mongoose';

export const DateType = Type.Unsafe<Date>({
	type: 'string',
	format: 'date'
});

export const DateTimeType = Type.Unsafe<Date>({
	type: 'string',
	format: 'date-time'
});

export const ObjectIdType = Type.Unsafe<MongooseTypes.ObjectId>({
	type: 'string'
});

export const IdParamsType = Type.Object({
	id: Type.String()
});

export const SearchBodyType = Type.Object({
	s: Type.String(),
	q: Type.Object({})
});

export const DirectionType = Type.Union([
	Type.Literal('ASC'),
	Type.Literal('DESC'),
	Type.Literal(1),
	Type.Literal(-1)
]);

export const PagingQueryStringType = Type.Partial(
	Type.Object({
		page: Type.Integer(),
		size: Type.Integer(),
		sort: Type.String(),
		dir: DirectionType
	})
);

export const PagingResultsType = <T extends TSchema>(T: T) =>
	Type.Object({
		pageNumber: Type.Integer(),
		pageSize: Type.Integer(),
		totalPages: Type.Integer(),
		totalSize: Type.Integer(),
		elements: Type.Array(T)
	});
