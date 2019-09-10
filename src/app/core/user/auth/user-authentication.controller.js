'use strict';

const
	q = require('q'),

	deps = require('../../../../dependencies'),
	dbs = deps.dbs,
	config = deps.config,
	util = deps.utilService,
	auditService = deps.auditService,

	userAuthService = require('./user-authentication.service'),
	userAuthorizationService = require('./user-authorization.service'),
	TeamMember = dbs.admin.model('TeamUser'),
	User = dbs.admin.model('User');


/**
 * ==========================================================
 * Private methods
 * ==========================================================
 */

// Login the user
function login(user, req, res) {
	userAuthService.login(user, req)
		.then(
			(result) => {
				userAuthorizationService.updateRoles(result, config.auth);
				res.status(200).json(result);
			},
			(err) => {
				util.handleErrorResponse(res, err);
			})
		.done();
}

//Authenticate and login the user. Passport handles authentication.
function authenticateAndLogin(req, res, next) {
	userAuthService.authenticateAndLogin(req, res, next)
		.then(
			(result) => {
				userAuthorizationService.updateRoles(result, config.auth);
				res.status(200).json(result);
			},
			(err) => {
				util.handleErrorResponse(res, err);
			})
		.done();
}

// Admin creates a user
function adminCreateUser(user, req, res) {
	// Initialize the user

		userAuthService.initializeNewUser(user).then((result) => {
			return result.save();
		}).then((result) => {
			return auditService.audit('admin user create', 'user', 'admin user create', TeamMember.auditCopy(req.user, util.getHeaderField(req.headers, 'x-real-ip')), User.auditCopy(result), req.headers)
				.then(() => q(result));
		}).then((result) => {
				res.status(200).json(User.fullCopy(result));
			},
			(err) => {
				util.handleErrorResponse(res, err);
			})
		.done();
}

// Signup the user - creates the user object and logs in the user
const signup = (user, req, res) => {
	// Initialize the user

	userAuthService.initializeNewUser(user).then(() => {
		return user.save();
	}).then((newUser) => {
		// Send email for new user if enabled, no reason to wait for success
		if (config.newUser) {
			if (config.newUser.adminNotification) {
				userAuthService.signupEmail(user, req);
			}

			if (config.newUser.welcomeNotification) {
				userAuthService.welcomeEmail(user, req);
			}
		}
		return auditService.audit('user signup', 'user', 'user signup', {}, User.auditCopy(newUser), req.headers).then(() => newUser);
	}).then((newUser) => {
		login(newUser, req, res);
	}, (err) => {
		util.handleErrorResponse(res, err);
	}).done();
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
	let user = new User(User.createCopy(req.body));
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
	let dn = req.headers[config.auth.header];
	if (null == dn) {
		res.status('400').json({ message: 'Missing PKI information.' });
		return;
	}

	let user = new User(User.createCopy(req.body));
	user.providerData = { dn: dn, dnLower: dn.toLowerCase() };
	user.username = dn; //TODO: extract the username
	user.provider = 'pki';

	signup(user, req, res);
};


/**
 * Admin Create a User (Local Strategy)
 */
exports.adminCreateUser = (req, res) => {
	let user = new User(User.createCopy(req.body));
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
	let user = new User(User.createCopy(req.body));
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


// API middleware - stores the user corresponding to the externally identifiable id in 'userParam'
module.exports.userByExternalId = function(req, res, next) {
	let identifier = req.query.userId;

	// If the identifier is missing, reject the request
	if(null == identifier) {
		return q.reject({ status: 400, message: 'Missing required parameter userId'});
	} else {
		identifier = identifier.toLowerCase();
	}

	let find;
	if(config.auth.strategy === 'local') {
		// If we're in local mode, the external id is the username
		find = {
			username: identifier
		};
	}
	else if(config.auth.strategy === 'proxy-pki') {
		// If we're in proxy-pki mode, the external id is the DN of the user
		find = {
			'providerData.dnLower': identifier
		};
	}

	return User.findOne(find).exec()
		.then(function(result) {
			if(null != result) {
				// If we got a result, we're good
				req.userParam = result;
				return q();
			}
			else {
				return q.reject({ status: 401, message: `Unknown user ' ${identifier} `});
			}
		}, function(err) {
			return q.reject(err);
		});
};
