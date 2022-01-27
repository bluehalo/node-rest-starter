'use strict';

const _ = require('lodash'),
	passport = require('passport'),
	deps = require('../../dependencies'),
	config = deps.config,
	userService = require('../../app/core/user/user.service'),
	userAuthService = require('../../app/core/user/auth/user-authentication.service'),
	TrustedHeadersStrategy = require('../../app/common/passport/trusted-headers-strategy');

class ProxyPkiStrategy extends TrustedHeadersStrategy {
	constructor(options, verify) {
		options.headers = [
			options.primaryUserHeader ?? 'x-ssl-client-s-dn',
			options.proxiedUserHeader ?? 'x-proxied-user-dn',
			options.masqueradeUserHeader ?? 'x-masquerade-user-dn'
		];
		super(options, verify);
		this.name = 'proxy-pki';
	}
}

const verify = async (
	req,
	[primaryUserDn, proxiedUserDn, masqueradeUserDn],
	done
) => {
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
				secondaryUser.lastLogin + config.auth.sessionCookie.maxAge < Date.now()
			) {
				userService.updateLastLogin(secondaryUser);
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
				secondaryUser.lastLogin + config.auth.sessionCookie.maxAge < Date.now()
			) {
				userService.updateLastLogin(secondaryUser);
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
			message: 'Could not authenticate request, please verify your credentials.'
		});
	}
};

/**
 * Export the PKI Proxy strategy
 */
module.exports = () => {
	passport.use(
		new ProxyPkiStrategy(
			{
				primaryUserHeader: config.proxyPkiPrimaryUserHeader,
				proxiedUserHeader: config.proxyPkiProxiedUserHeader,
				masqueradeUserHeader: config.masqueradeUserHeader
			},
			verify
		)
	);
};
