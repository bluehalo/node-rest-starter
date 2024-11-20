import { FastifyReply, FastifyRequest } from 'fastify';
import _ from 'lodash';

import userAuthorizationService from './user-authorization.service';
import { config } from '../../../../dependencies';
import { ForbiddenError, UnauthorizedError } from '../../../common/errors';
import userAuthService from '../auth/user-authentication.service';
import { requireEua } from '../eua/eua.middleware';

export type AuthRequirementFunction = (
	req: FastifyRequest,
	reply: FastifyReply
) => Promise<void>;

export function requireLogin(
	req: FastifyRequest,
	rep: FastifyReply
): Promise<void> {
	if (req.isAuthenticated()) {
		return Promise.resolve();
	}
	// Only try to auto login if it's explicitly set in the config
	if (config.get<boolean>('auth.autoLogin')) {
		return userAuthService.authenticateAndLogin(req, rep).then();
	}

	return Promise.reject(new UnauthorizedError('User is not logged in'));
}

export function requireExternalRoles(
	req: FastifyRequest,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	rep: FastifyReply
): Promise<void> {
	const requiredRoles = config.get<string[]>('auth.requiredRoles');

	// If there are required roles, check for them
	if (req.user.bypassAccessCheck === false && requiredRoles.length > 0) {
		// Get the user roles
		const userRoles = _.isArray(req.user.externalRoles)
			? req.user.externalRoles
			: [];

		// Reject if the user is missing required roles
		if (_.difference(requiredRoles, userRoles).length > 0) {
			return Promise.reject(
				new ForbiddenError('User is missing required external roles')
			);
		}
		// Resolve if they had all the roles
		return Promise.resolve();
	}
	// Resolve if we don't need to check
	return Promise.resolve();
}

export function requireRoles(
	roles: string[],
	errorMessage = 'User is missing required roles'
): AuthRequirementFunction {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	return function (req: FastifyRequest, rep: FastifyReply): Promise<void> {
		if (userAuthorizationService.hasRoles(req.user, roles)) {
			return Promise.resolve();
		}
		return Promise.reject(new ForbiddenError(errorMessage));
	};
}

export function requireAny(
	...requirements: AuthRequirementFunction[]
): AuthRequirementFunction {
	return async (req: FastifyRequest, rep: FastifyReply): Promise<void> => {
		if (requirements.length > 0) {
			let lastError: unknown;
			for (const requirement of requirements) {
				try {
					// eslint-disable-next-line no-await-in-loop
					await requirement(req, rep);
					return Promise.resolve();
				} catch (error) {
					// Failure means keep going.
					lastError = error;
				}
			}
			return Promise.reject(lastError);
		}
		return Promise.resolve();
	};
}

export function requireAll(
	...requirements: AuthRequirementFunction[]
): AuthRequirementFunction {
	return async (req: FastifyRequest, rep: FastifyReply): Promise<void> => {
		for (const requirement of requirements) {
			try {
				// eslint-disable-next-line no-await-in-loop
				await requirement(req, rep);
			} catch (error) {
				return Promise.reject(error);
			}
		}
		return Promise.resolve();
	};
}

export const requireUserRole = requireRoles(
	['user'],
	'User account is inactive'
);
export const requireMachineRole = requireRoles(['machine']);
export const requireEditorRole = requireRoles(['editor']);
export const requireAdminRole = requireRoles(['admin']);
export const requireAuditorRole = requireRoles(['auditor']);

export const requireAccess = requireAll(
	requireLogin,
	requireAny(requireUserRole, requireMachineRole),
	requireExternalRoles,
	requireEua
);

export const requireAdminAccess = requireAll(requireLogin, requireAdminRole);

export const requireAuditorAccess = requireAll(
	requireLogin,
	requireUserRole,
	requireExternalRoles,
	requireAuditorRole,
	requireEua
);

export const requireEditorAccess = requireAll(
	requireLogin,
	requireAny(requireUserRole, requireMachineRole),
	requireExternalRoles,
	requireAny(requireAdminRole, requireEditorRole),
	requireEua
);
