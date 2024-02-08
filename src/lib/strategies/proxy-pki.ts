import _ from 'lodash';

import { TrustedHeadersStrategy } from '../../app/common/passport/trusted-headers-strategy';
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

	async verify(req, [primaryUserDn, proxiedUserDn, masqueradeUserDn], done) {
		// If there is no DN, we can't authenticate
		if (!primaryUserDn) {
			return done(null, false, {
				status: 400,
				type: 'missing-credentials',
				message: 'Missing certificate'
			});
		}

		try {
			const primaryUser = await userAuthService.verifyUser(primaryUserDn, req);

			if (proxiedUserDn) {
				// Return error if primary user tries to proxy to another user
				if (!primaryUser.canProxy) {
					return done(null, false, {
						status: 403,
						type: 'authentication-error',
						message:
							'Not approved to proxy users. Please verify your credentials.'
					});
				}

				const secondaryUser = await userAuthService.verifyUser(
					proxiedUserDn,
					req,
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
					req,
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
		} catch (err) {
			if (err.status && err.type && err.message) {
				return done(null, false, err);
			}
			return done(null, false, {
				status: 403,
				type: 'authentication-error',
				message:
					'Could not authenticate request, please verify your credentials.'
			});
		}
	}
}

/**
 * Export the PKI Proxy strategy
 */
export = new ProxyPkiStrategy();
