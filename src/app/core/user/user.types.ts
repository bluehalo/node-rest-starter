import { Type } from '@fastify/type-provider-typebox';

import { UserType } from './user.model';

export const UserReturnType = Type.Omit(UserType, [
	'password',
	'salt',
	'resetPasswordToken',
	'resetPasswordExpires'
]);

export const UpdateUserType = Type.Object({
	name: Type.String(),
	organization: Type.String(),
	email: Type.String({ format: 'email' }),
	username: Type.String(),
	password: Type.Optional(Type.String()),
	currentPassword: Type.Optional(Type.String())
});

export const CreateUserType = Type.Omit(UserType, [
	'_id',
	'provider',
	'updated',
	'created'
]);

export const AdminUpdateUserType = Type.Partial(CreateUserType);
