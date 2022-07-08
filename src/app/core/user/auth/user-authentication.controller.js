'use strict';

const { dbs, config, auditService } = require('../../../../dependencies'),
	userAuthService = require('./user-authentication.service'),
	userAuthorizationService = require('./user-authorization.service'),
	userEmailService = require('../user-email.service'),
	teamService = require('../../teams/teams.service'),
	User = dbs.admin.model('User');

/**
 * ==========================================================
 * Private methods
 * ==========================================================
 */
// Admin creates a user
async function adminCreateUser(user, req, res) {
	// Initialize the user
	const result = await userAuthService.initializeNewUser(user);
	await result.save();

	auditService.audit(
		'admin user create',
		'user',
		'admin user create',
		req,
		User.auditCopy(result)
	);
	res.status(200).json(User.fullCopy(result));
}

// Signup the user - creates the user object and logs in the user
const signup = async (user, req, res) => {
	// Initialize the user
	const newUser = await userAuthService.initializeNewUser(user);
	await newUser.save();

	userEmailService.signupEmail(newUser, req);
	userEmailService.welcomeNoAccessEmail(newUser, req);

	auditService.audit(
		'user signup',
		'user',
		'user signup',
		req,
		User.auditCopy(newUser)
	);

	const result = await userAuthService.login(user, req);
	userAuthorizationService.updateRoles(result);
	await teamService.updateTeams(result);
	res.status(200).json(result);
};

/**
 * ==========================================================
 * Public Methods
 * ==========================================================
 */

/**
 * Local Signup strategy. Provide a username/password
 * and user info in the request body.
 */
exports.signup = (req, res) => {
	const user = new User(User.createCopy(req.body));
	user.provider = 'local';

	// Need to set null passwords to empty string for mongoose validation to work
	if (null == user.password) {
		user.password = '';
	}

	signup(user, req, res);
};

/**
 * Proxy PKI signup. Provide a DN in the request header
 * and then user info in the request body.
 */
exports.proxyPkiSignup = (req, res) => {
	const dn = req.headers[config.auth.header];
	if (null == dn) {
		res.status('400').json({ message: 'Missing PKI information.' });
		return;
	}

	const user = new User(User.createCopy(req.body));
	user.providerData = { dn: dn, dnLower: dn.toLowerCase() };
	user.username = dn; //TODO: extract the username
	user.provider = 'pki';

	signup(user, req, res);
};

/**
 * Admin Create a User (Local Strategy)
 */
exports.adminCreateUser = async (req, res) => {
	const user = new User(User.createCopy(req.body));
	user.bypassAccessCheck = req.body.bypassAccessCheck;
	user.roles = req.body.roles;
	user.provider = 'local';

	// Need to set null passwords to empty string for mongoose validation to work
	if (null == user.password) {
		user.password = '';
	}

	await adminCreateUser(user, req, res);
};

/**
 * Admin Create a User (Pki Strategy)
 */
exports.adminCreateUserPki = async (req, res) => {
	const user = new User(User.createCopy(req.body));
	user.bypassAccessCheck = req.body.bypassAccessCheck;
	user.roles = req.body.roles;

	if (null != req.body.username) {
		user.username = req.body.username;
		user.providerData = {
			dn: req.body.username,
			dnLower: req.body.username.toLowerCase()
		};
	}
	user.provider = 'pki';

	await adminCreateUser(user, req, res);
};

/**
 * Local Signin
 */
exports.signin = async (req, res, next) => {
	const result = await userAuthService.authenticateAndLogin(req, res, next);
	userAuthorizationService.updateRoles(result);
	await teamService.updateTeams(result);
	res.status(200).json(result);
};

/**
 * Signout - logs the user out and redirects them
 */
exports.signout = (req, res) => {
	req.logout();
	res.redirect('/');
};
