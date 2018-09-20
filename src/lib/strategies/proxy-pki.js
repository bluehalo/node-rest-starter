'use strict';

const
	mongoose = require('mongoose'),
	passport = require('passport'),
	q = require('q'),
	util = require('util'),

	deps = require('../../dependencies'),
	dbs = deps.dbs,
	config = deps.config,
	auditService = deps.auditService,

	accessChecker = require('../../app/core/access-checker/access-checker.service'),
	userAuthService = require('../../app/core/user/auth/user-authentication.service'),
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
	this._header = options.header || 'x-ssl-client-s-dn';
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
	var self = this;

	// Get the DN from the header of the request
	var dn = req.headers[self._header];

	try {
		// Call the configurable verify function
		self._verify(req, dn, function (err, user, info) {

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
	['name', 'organization', 'email', 'username'].forEach(function(e) {
		// Only overwrite if there's a value
		if(null != src[e] && src[e].trim() !== '') {
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
function createUser(dn, acUser) {

	// Create the new user
	var newUser = new User({
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
	return userAuthService.initializeNewUser(newUser).then(function(initializedUser) {
		// Save the new user
		return initializedUser.save();
	});

}

function updateUser(dn, fields) {
	return User.findOneAndUpdate( { 'providerData.dnLower': dn.toLowerCase() }, fields, { new: true, upsert: false }).exec();
}


/**
 * Export the PKI Proxy strategy
 */
module.exports = () => {

	passport.use(new ProxyPkiStrategy({
		header: 'x-ssl-client-s-dn'
	}, (req, dn, done) => {

		// If there is no DN, we can't authenticate
		if (!dn){
			return done(null, false, {status: 400, type: 'missing-credentials', message: 'Missing certificate' });
		}

		let dnLower = dn.toLowerCase();

		// Get the user locally and from access checker
		q.all([
			q.ninvoke(User, 'findOne', { 'providerData.dnLower': dnLower }),
			accessChecker.get(dnLower)
		]).then((resultsArray) => {
			const localUser = resultsArray[0];
			const acUser = resultsArray[1];

			// Default to creating accounts automatically
			const autoCreateAccounts = (null != config.auth && null != config.auth.autoCreateAccounts) ? config.auth.autoCreateAccounts : true;

			// If the user is not known locally, is not known by access checker, and we are creating accounts, create the account as an empty account
			if (null == localUser && null == acUser && !autoCreateAccounts) {
				done(null, false, { status: 401, type: 'invalid-credentials', message: 'Certificate unknown, expired, or unauthorized' });
			}
			// Else if the user is not known locally, and we are creating accounts, create the account as an empty account
			else if (null == localUser && autoCreateAccounts) {
				// Create the user
				createUser(dn, acUser).then((newUser) => {
					// Send email for new user if enabled, no reason to wait for success
					if (config.newUser) {
						if (config.newUser.adminNotification) {
							userAuthService.signupEmail(newUser, req);
						}

						if (config.newUser.welcomeNotification) {
							userAuthService.welcomeEmail(newUser, req);
						}
					}

					// Audit user signup
					return auditService.audit( 'user signup', 'user', 'user signup', {}, User.auditCopy(newUser)).then(() => newUser);
				}).then((result) => {
					// Return the user
					done(null, result);
				}, done).done();
			}
			// Else if the user is known locally, but not in access checker, update their user info to reflect
			else if (null == acUser) {
				// Update the user only if we are not bypassing access checker
				if(!localUser.bypassAccessCheck) {
					updateUser(dn, { externalRoles: [], externalGroups: [] }).then(function(updatedUser) {
						// Audit user signup
						return auditService.audit('user updated from access checker', 'user', 'update', TeamMember.auditCopy(localUser), User.auditCopy(updatedUser)).then(() => updatedUser).then((result) => {
							// Return the user
							done(null, result);
						}, done).done();
					});
				}
				// Otherwise, just return the user
				else {
					done(null, localUser);
				}
			}
			// If the user is known locally and in access checker, update their user info
			else {
				// Update the user only if we are not bypassing access checker
				if (!localUser.bypassAccessCheck) {
					updateUser(dn, copyACGroups(copyACRoles(copyACMetadata({}, acUser), acUser), acUser)).then(function(updatedUser) {
						// Audit user signup
						return auditService.audit('user updated from access checker', 'user', 'update', TeamMember.auditCopy(localUser), User.auditCopy(updatedUser)).then(function() {
							return q(updatedUser);
						});
					}).then(function(result) {
						// Return the user
						done(null, result);
					}, done).done();
				}
				else {
					done(null, localUser);
				}
			}

		}, function(err) {
			// If there was an error, then something is broken and authentication has failed
			return done(err);
		});

	}));

};
