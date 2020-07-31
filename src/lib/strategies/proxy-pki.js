'use strict';

const
	_ = require('lodash'),
	mongoose = require('mongoose'),
	passport = require('passport'),
	util = require('util'),

	deps = require('../../dependencies'),
	dbs = deps.dbs,
	config = deps.config,
	auditService = deps.auditService,

	accessChecker = require('../../app/core/access-checker/access-checker.service'),
	userAuthService = require('../../app/core/user/auth/user-authentication.service'),
	userEmailService = require('../../app/core/user/user-email.service'),
	TeamMember = dbs.admin.model('TeamUser'),
	User = mongoose.model('User');

function ProxyPkiStrategy(options, verify) {
	if (typeof options === 'function') {
		verify = options;
		options = {};
	}

	if (!verify) throw new Error('Proxy Pki Strategy requires a verify function');

	passport.Strategy.call(this);

	this.name = 'proxy-pki';
	this._verify = verify;
	this._primaryUserHeader = options.primaryUserHeader || 'x-ssl-client-s-dn';
	this._proxiedUserHeader = options.proxiedUserHeader || 'x-proxied-user-dn';
}

/**
 * Inherit from `passport.Strategy`.
 */
util.inherits(ProxyPkiStrategy, passport.Strategy);

/**
 * Authenticate request based on the contents of the dn header value.
 *
 * @param {Object} req
 * @api protected
 */
ProxyPkiStrategy.prototype.authenticate = function(req) {
	const self = this;

	// Get the DN from the header of the request
	const primaryUserDn = req.headers[self._primaryUserHeader];
	const proxiedUserDn = req.headers[self._proxiedUserHeader];

	try {
		// Call the configurable verify function
		self._verify(req, primaryUserDn, proxiedUserDn, (err, user, info) => {

			// If there was an error, pass it through
			if (err) { return self.error(err); }

			// If there was no user, fail the auth check
			if (!user) { return self.fail(info); }

			// Otherwise, succeed
			self.success(user);
		});

	} catch(ex) {
		return self.error(ex);
	}
};

function copyACMetadata(dest, src) {
	src = src || {};
	dest = dest || {};

	// Copy each field from the access checker user to the local user
	['name', 'organization', 'email', 'username'].forEach((e) => {
		// Only overwrite if there's a value
		if (null != src[e] && src[e].trim() !== '') {
			dest[e] = src[e];
		}
	});

	return dest;
}

function copyACRoles(dest, src) {
	src = src || {};
	dest = dest || {};

	dest.externalRoles = src.roles;

	return dest;
}

function copyACGroups(dest, src) {
	src = src || {};
	dest = dest || {};

	dest.externalGroups = src.groups;

	return dest;
}

/**
 * Create the user locally given the information from access checker
 */
async function createUser(dn, acUser) {

	// Create the new user
	const newUser = new User({
		name: 'unknown',
		organization: 'unknown',
		organizationLevels: {},
		email: 'unknown@mail.com',
		username: dn.toLowerCase()
	});

	// Copy over the access checker metadata
	copyACMetadata(newUser, acUser);
	copyACRoles(newUser, acUser);
	copyACGroups(newUser, acUser);

	// Add the provider data
	newUser.providerData = { dn: dn, dnLower: dn.toLowerCase() };
	newUser.provider = 'pki';

	// Initialize the new user
	const initializedUser = await userAuthService.initializeNewUser(newUser);

	// Check for existing user with same username
	const existingUser = await User.findOne({username: initializedUser.username}).exec();

	// If existing user doesn't exists, save
	if (null == existingUser) {
		return initializedUser.save();
	}

	// Otherwise update providerData with dn
	return User.findOneAndUpdate(
		{ username: initializedUser.username },
		{ 'providerData.dn': dn, 'providerData.dnLower': dn.toLowerCase() },
		{ new: true, upsert: true }
	);
}

function updateUser(dn, fields) {
	return User.findOneAndUpdate( { 'providerData.dnLower': dn.toLowerCase() }, fields, { new: true, upsert: false }).exec();
}

async function handleUser(dn, req, isProxy) {
	const dnLower = dn.toLowerCase();

	const localUser = await User.findOne({ 'providerData.dnLower': dnLower }).exec();

	// Bypass AC check
	if (localUser && localUser.bypassAccessCheck) {
		return localUser;
	}

	const acUser = await accessChecker.get(dnLower);

	// Default to creating accounts automatically
	const autoCreateAccounts = _.get(config, 'auth.autoCreateAccounts', true);

	// If the user is not known locally, is not known by access checker, and we are creating accounts, create the account as an empty account
	if (null == localUser && null == acUser && (isProxy || !autoCreateAccounts)) {
		throw { status: 401, type: 'invalid-credentials', message: 'Certificate unknown, expired, or unauthorized' };
	}

	// Else if the user is not known locally, and we are creating accounts, create the account as an empty account
	if (null == localUser && autoCreateAccounts) {
		// Create the user
		const newUser = await	createUser(dn, acUser);

		// Send email for new user if enabled, no reason to wait for success
		if (config.coreEmails) {
			if (config.coreEmails.userSignupAlert && config.coreEmails.userSignupAlert.enabled) {
				userEmailService.signupEmail(newUser, req);
			}

			if (config.coreEmails.userSignupAlert && config.coreEmails.welcomeEmail.enabled) {
				userEmailService.welcomeEmail(newUser, req);
			}
		}

		// Audit user signup
		await auditService.audit( 'user signup', 'user', 'user signup', {}, User.auditCopy(newUser));

		return newUser;
	}

	// Else if the user is known locally, but not in access checker, update their user info to reflect
	let updatedUser;
	if (null == acUser) {
		// Update the user
		updatedUser = await updateUser(dn, { externalRoles: [], externalGroups: [] });

		// Audit user update
		await auditService.audit('user updated from access checker', 'user', 'update', TeamMember.auditCopy(localUser), User.auditCopy(updatedUser));

		return updatedUser;
	}

	// Else if the user is known locally and in access checker, update their user info
	updatedUser = await updateUser(dn, copyACGroups(copyACRoles(copyACMetadata({}, acUser), acUser), acUser));

	// Audit user update
	await auditService.audit('user updated from access checker', 'user', 'update', TeamMember.auditCopy(localUser), User.auditCopy(updatedUser));

	return updatedUser;
}

/**
 * Export the PKI Proxy strategy
 */
module.exports = () => {
	passport.use(new ProxyPkiStrategy({
		primaryUserHeader: 'x-ssl-client-s-dn',
		proxiedUserHeader: 'x-proxied-user-dn'
	}, (async (req, primaryUserDn, proxiedUserDn, done) => {
		// If there is no DN, we can't authenticate
		if (!primaryUserDn){
			return done(null, false, {status: 400, type: 'missing-credentials', message: 'Missing certificate' });
		}

		try {
			let proxiedUser = null;
			const primaryUser = await handleUser(primaryUserDn, req);

			if (proxiedUserDn) {
				if (primaryUser.canProxy) {
					proxiedUser = await handleUser(proxiedUserDn, req, true);

					// Treat the proxied user account as if it's logging
					// in by updating their lastLogin time.
					if (!proxiedUser.lastLogin || proxiedUser.lastLogin + config.auth.sessionCookie.maxAge < Date.now()) {
						proxiedUser = await User.findOneAndUpdate(
							{ _id: proxiedUser._id },
							{ lastLogin: Date.now() },
							{ new: true, upsert: false }
						);
					}
				}
				else {
					return done(null, false, { status: 403, type: 'authentication-error', message: 'Not approved to proxy users. Please verify your credentials.' });
				}
			}

			if (proxiedUser === null) {
				return done(null, primaryUser);
			}
			proxiedUser.externalGroups =  _.intersection(primaryUser.externalGroups, proxiedUser.externalGroups);
			proxiedUser.externalRoles =  _.intersection(primaryUser.externalRoles, proxiedUser.externalRoles);
			return done(null, proxiedUser);
		} catch(err) {
			if (err.status && err.type && err.message) {
				done(null, false, err);
			} else {
				done(null, false, { status: 403, type: 'authentication-error', message: 'Could not authenticate request, please verify your credentials.' });
			}
		}
	})));
};
