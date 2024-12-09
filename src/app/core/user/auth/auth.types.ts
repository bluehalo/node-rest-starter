import { Type } from '@fastify/type-provider-typebox';

import { UserType } from '../user.model';

export const SigninType = Type.Pick(UserType, ['username', 'password']);

export const SignupType = Type.Pick(UserType, [
	'username',
	'password',
	'name',
	'organization',
	'email'
]);

export const TokenParamsType = Type.Object({ token: Type.String() });
