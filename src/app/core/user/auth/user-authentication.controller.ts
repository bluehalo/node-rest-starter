import { auditService, config, dbs } from '../../../../dependencies';
import teamService from '../../teams/teams.service';
import userEmailService from '../user-email.service';
import { UserDocument, UserModel } from '../user.model';
import userAuthService from './user-authentication.service';
import userAuthorizationService from './user-authorization.service';

const User = dbs.admin.model('User') as UserModel;

/**
 * ==========================================================
 * Private methods
 * ==========================================================
 */

// Signup the user - creates the user object and logs in the user
const _signup = async (user: UserDocument, req, res) => {
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
		newUser.auditCopy()
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
export const signup = (req, res) => {
	const user = new User(User.createCopy(req.body));
	user.provider = 'local';

	// Need to set null passwords to empty string for mongoose validation to work
	if (null == user.password) {
		user.password = '';
	}

	return _signup(user, req, res);
};

/**
 * Proxy PKI signup. Provide a DN in the request header
 * and then user info in the request body.
 */
export const proxyPkiSignup = (req, res) => {
	const dn = req.headers[config.auth.header];
	if (null == dn) {
		res.status('400').json({ message: 'Missing PKI information.' });
		return;
	}

	const user = new User(User.createCopy(req.body));
	user.providerData = { dn: dn, dnLower: dn.toLowerCase() };
	user.username = dn; //TODO: extract the username
	user.provider = 'pki';

	return _signup(user, req, res);
};

/**
 * Local Signin
 */
export const signin = async (req, res, next) => {
	const result = await userAuthService.authenticateAndLogin(req, res, next);

	userAuthorizationService.updateRoles(result);
	await teamService.updateTeams(result);
	res.status(200).json(result);
};

/**
 * Signout - logs the user out and redirects them
 */
export const signout = (req, res) => {
	req.logout(() => {
		res.redirect('/');
	});
};
