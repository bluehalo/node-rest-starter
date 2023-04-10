import { Router } from 'express';

import { hasAccess, hasLogin } from './user-auth.middleware';
import * as users from './user.controller';

const router = Router();

/**
 * @swagger
 * /user/me:
 *   get:
 *     tags: [User]
 *     description: Returns information about the authenticated user.
 *     responses:
 *       '200':
 *         description: The authenticated user's profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */
// Self-service user routes
router
	.route('/user/me')
	.get(hasLogin, users.getCurrentUser)
	.post(hasLogin, users.updateCurrentUser);

// User getting another user's info
router.route('/user/:userId').get(hasAccess, users.getUserById);

router.route('/user-preference').post(hasLogin, users.updatePreferences);

router.route('/user/required-org').post(hasLogin, users.updateRequiredOrgs);

// User searching for other users
router.route('/users').post(hasAccess, users.searchUsers);

// User match-based search for other users (this searches based on a fragment)
router.route('/users/match').post(hasAccess, users.matchUsers);

// Finish by binding the user middleware
router.param('userId', users.userById);

export = router;
