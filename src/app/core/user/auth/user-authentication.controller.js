'use strict';

const deps = require('../../../../dependencies'),
	dbs = deps.dbs,
	config = deps.config,
	util = deps.utilService,
	auditService = deps.auditService,

	userAuthService = require('./user-authentication.service'),
	userAuthorizationService = require('./user-authorization.service'),
	userEmailService = require('../user-email.service'),
	TeamMember = dbs.admin.model('TeamUser'),
	User = dbs.admin.model('User');


/**
 * ==========================================================
 * Private methods
 * ==========================================================
 */

// Login the user
async function login(user, req, res) {
	try {
		const result = await userAuthService.login(user, req);
		userAuthorizationService.updateRoles(result);
		res.status(200).json(result);
	} catch(err) {
		util.handleErrorResponse(res, err);
	}
}

//Authenticate and login the user. Passport handles authentication.
async function authenticateAndLogin(req, res, next) {
	try {
		const result = await userAuthService.authenticateAndLogin(req, res, next);
		userAuthorizationService.updateRoles(result);
		res.status(200).json(result);
	} catch (err) {
		util.handleErrorResponse(res, err);
	}
}

// Admin creates a user
async function adminCreateUser(user, req, res) {
	// Initialize the user
	try {
		const result = await userAuthService.initializeNewUser(user);
		await result.save();
		await auditService.audit('admin user create', 'user', 'admin user create', TeamMember.auditCopy(req.user, util.getHeaderField(req.headers, 'x-real-ip')), User.auditCopy(result), req.headers);
		res.status(200).json(User.fullCopy(result));
	} catch (err) {
		util.handleErrorResponse(res, err);
	}
}

// Signup the user - creates the user object and logs in the user
const signup = (user, req, res) => {
	// Initialize the user
	userAuthService.initializeNewUser(user).then(() => {
		return user.save();
	}).then((newUser) => {
		// Send email for new user if enabled, no reason to wait for success
		if (config.coreEmails) {
			if (config.coreEmails.userSignupAlert && config.coreEmails.userSignupAlert.enabled) {
				userEmailService.signupEmail(user, req);
			}

			if (config.coreEmails.welcomeEmail && config.coreEmails.welcomeEmail.enabled) {
				userEmailService.welcomeEmail(user, req);
			}
		}
		return auditService.audit('user signup', 'user', 'user signup', {}, User.auditCopy(newUser), req.headers).then(() => newUser);
	}).then((newUser) => {
		login(newUser, req, res);
	}).catch((err) => {
		util.handleErrorResponse(res, err);
	});
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
	if(null == user.password) {
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
exports.adminCreateUser = (req, res) => {
	const user = new User(User.createCopy(req.body));
	user.bypassAccessCheck = req.body.bypassAccessCheck;
	user.roles = req.body.roles;
	user.provider = 'local';

	// Need to set null passwords to empty string for mongoose validation to work
	if (null == user.password) {
		user.password = '';
	}

	adminCreateUser(user, req, res);
};


/**
 * Admin Create a User (Pki Strategy)
 */
exports.adminCreateUserPki = (req, res) => {
	const user = new User(User.createCopy(req.body));
	user.bypassAccessCheck = req.body.bypassAccessCheck;
	user.roles = req.body.roles;

	if (null != req.body.username) {
		user.username = req.body.username;
		user.providerData = { dn: req.body.username, dnLower: req.body.username.toLowerCase() };
	}
	user.provider = 'pki';

	adminCreateUser(user, req, res);
};


/**
 * Local Signin
 */
exports.signin = (req, res, next) => {
	authenticateAndLogin(req, res, next);
};

/**
 * Signout - logs the user out and redirects them
 */
exports.signout = (req, res) => {
	req.logout();
	res.redirect('/');
};
