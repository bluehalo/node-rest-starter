'use strict';

const
	express = require('express'),

	deps = require('../../../dependencies'),
	config = deps.config,
	logger = deps.logger,

	users = require('./user.controller');


const router = express.Router();

/**
 * User Routes (don't require admin)
 */

/**
 * @swagger
 * definitions:
 *   User:
 *     type: object
 *     properties:
 *       username:
 *          type: string
 *       name:
 *          type: string
 *     example:
 *       username: 'jbuser'
 *       name: 'Jane B. User'
 */

/**
 * @swagger
 * /user/me:
 *   get:
 *     produces:
 *       - application/json
 *     tags: [User]
 *     description: Returns information about the authenticated user.
 *     responses:
 *       '200':
 *         description: The authenticated user's profile
 *         schema:
 *           $ref: '#/definitions/User'
 */
// Self-service user routes
router.route('/user/me')
	.get( users.has(users.requiresLogin), users.getCurrentUser)
	.post(users.has(users.requiresLogin), users.updateCurrentUser);

// User getting another user's info
router.route('/user/:userId')
	.get(users.hasAccess, users.getUserById);

router.route('/user-preference')
	.post(users.has(users.requiresLogin), users.updatePreferences);

router.route('/user/required-org')
	.post(users.has(users.requiresLogin), users.updateRequiredOrgs);

// User searching for other users
router.route('/users')
	.post(users.hasAccess, users.searchUsers);

// User match-based search for other users (this searches based on a fragment)
router.route('/users/match')
	.post(users.hasAccess, users.matchUsers);

/**
 * Admin User Routes (requires admin)
 */

// Admin retrieve/update/delete
router.route('/admin/user/:userId')
	.get(   users.hasAdminAccess, users.adminGetUser)
	.post(  users.hasAdminAccess, users.adminUpdateUser)
	.delete(users.hasAdminAccess, users.adminDeleteUser);

// Admin search users
router.route('/admin/users')
	.post(users.hasAdminAccess, users.adminSearchUsers);

// Get user CSV using the specifies config id
router.route('/admin/users/csv/:exportId')
	.get(users.hasAdminAccess, users.adminGetCSV);

// Admin retrieving a User field for all users in the system
router.route('/admin/users/getAll')
	.post(users.hasAdminAccess, users.adminGetAll);

/**
 * Auth-specific routes
 */

/**
 * @swagger
 * /auth/signin:
 *   post:
 *     consumes:
 *       - application/json
 *     produces:
 *       - application/json
 *     tags: [Auth]
 *     description: authenticates the user.
 *     parameters:
 *       - in: body
 *         name: credentials
 *         schema:
 *           type: object
 *           properties:
 *             username:
 *               type: string
 *             password:
 *               type: string
 *           example:
 *             username: 'some_user'
 *             password: 'abc124'
 *     responses:
 *       '200':
 *          description: The authenticated user's profile
 *          schema:
 *            $ref: '#/definitions/User'
 */
router.route('/auth/signin').post(users.signin);

/**
 * @swagger
 * /auth/signout:
 *   get:
 *     produces:
 *       - application/json
 *     tags: [Auth]
 *     description: signs out the user.
 *     responses:
 *       '200':
 *          description: User was signed out.
 */
router.route('/auth/signout')
	.get(users.has(users.requiresLogin), users.signout);

/**
 * Routes that only apply to the 'local' passport strategy
 */
if (config.auth.strategy === 'local') {

	logger.info('Configuring local user authentication routes.');

	// Admin Create User
	router.route('/admin/user')
		.post(users.hasAdminAccess, users.adminCreateUser);

	// Default setup is basic local auth
	router.route('/auth/signup').post(users.signup);

	router.route('/auth/forgot').post(users.forgot);
	router.route('/auth/reset/:token').get(users.validateResetToken);
	router.route('/auth/reset/:token').post(users.reset);

}
/**
 * Routes that only apply to the 'proxy-pki' passport strategy
 */
else if (config.auth.strategy === 'proxy-pki') {

	logger.info('Configuring proxy-pki user authentication routes.');

	// Admin Create User
	router.route('/admin/user')
		.post(users.hasAdminAccess, users.adminCreateUserPki);

	// DN passed via header from proxy
	router.route('/auth/signup').post(users.proxyPkiSignup);

}

// Finish by binding the user middleware
router.param('userId', users.userById);

module.exports = router;
