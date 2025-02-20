// eslint-disable-next-line n/no-extraneous-import
import { Request } from 'express';
import { FastifyRequest } from 'fastify';
import _ from 'lodash';

import {
	TrustedHeadersStrategy,
	VerifyCallbackFunction
} from '../../app/common/passport/trusted-headers-strategy';
import userAuthService from '../../app/core/user/auth/user-authentication.service';
import userService from '../../app/core/user/user.service';
import { config } from '../../dependencies';

class ProxyPkiStrategy extends TrustedHeadersStrategy {
	constructor() {
		super([
			config.get<string>('proxyPkiPrimaryUserHeader'),
			config.get<string>('proxyPkiProxiedUserHeader'),
			config.get<string>('masqueradeUserHeader')
		]);
		this.name = 'proxy-pki';
	}

	async verify(
		req: Request,
		[primaryUserDn, proxiedUserDn, masqueradeUserDn]: [string, string, string],
		done: VerifyCallbackFunction
	) {
		// If there is no DN, we can't authenticate
		if (!primaryUserDn) {
			return done(null, false, 'Missing certificate');
		}

		try {
			const primaryUser = await userAuthService.verifyUser(
				primaryUserDn,
				req as unknown as FastifyRequest
			);

			if (proxiedUserDn) {
				// Return error if primary user tries to proxy to another user
				if (!primaryUser.canProxy) {
					return done(
						null,
						false,
						'Not approved to proxy users. Please verify your credentials.'
					);
				}

				const secondaryUser = await userAuthService.verifyUser(
					proxiedUserDn,
					req as unknown as FastifyRequest,
					true
				);

				// Treat the secondary user account as if it's logging
				// in by updating their lastLogin time.
				if (
					!secondaryUser.lastLogin ||
					secondaryUser.lastLogin.getTime() +
						config.get<number>('auth.sessionCookie.maxAge') <
						Date.now()
				) {
					await userService.updateLastLogin(secondaryUser);
				}

				secondaryUser.externalGroups = _.intersection(
					primaryUser.externalGroups,
					secondaryUser.externalGroups
				);
				secondaryUser.externalRoles = _.intersection(
					primaryUser.externalRoles,
					secondaryUser.externalRoles
				);
				return done(null, secondaryUser);
			}

			// ignore masquerade header and login as normal if primaryUser can not masquerade
			if (masqueradeUserDn && primaryUser.canMasquerade) {
				const secondaryUser = await userAuthService.verifyUser(
					masqueradeUserDn,
					req as unknown as FastifyRequest,
					true
				);

				// Treat the secondary user account as if it's logging
				// in by updating their lastLogin time.
				if (
					!secondaryUser.lastLogin ||
					secondaryUser.lastLogin.getTime() +
						config.get<number>('auth.sessionCookie.maxAge') <
						Date.now()
				) {
					await userService.updateLastLogin(secondaryUser);
				}

				return done(null, secondaryUser);
			}

			return done(null, primaryUser);
		} catch (error) {
			if (error.status && error.type && error.message) {
				return done(null, false, error);
			}
			return done(
				null,
				false,
				'Could not authenticate request, please verify your credentials.'
			);
		}
	}
}

/**
 * Export the PKI Proxy strategy
 */
export = new ProxyPkiStrategy();
