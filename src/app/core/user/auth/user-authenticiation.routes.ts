import { Router } from 'express';

import * as userAuthentication from './user-authentication.controller';
import * as userPassword from './user-password.controller';
import { config } from '../../../../dependencies';
import { logger } from '../../../../lib/logger';

const router = Router();

/**
 * @swagger
 * /auth/signin:
 *   post:
 *     tags: [Auth]
 *     description: authenticates the user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *             example:
 *               username: 'some_user'
 *               password: 'abc124'
 *     responses:
 *       '200':
 *          description: The authenticated user's profile
 *          content:
 *            application/json:
 *              schema:
 *                $ref: '#/components/schemas/User'
 */
router.route('/auth/signin').post(userAuthentication.signin);

/**
 * @swagger
 * /auth/signout:
 *   get:
 *     tags: [Auth]
 *     description: signs out the user.
 *     responses:
 *       '200':
 *          description: User was signed out.
 */
router.route('/auth/signout').get(userAuthentication.signout);

/**
 * Routes that only apply to the 'local' passport strategy
 */
if (config.auth.strategy === 'local') {
	logger.info('Configuring local user authentication routes.');

	// Default setup is basic local auth
	router.route('/auth/signup').post(userAuthentication.signup);

	router.route('/auth/forgot').post(userPassword.forgot);
	router.route('/auth/reset/:token').get(userPassword.validateResetToken);
	router.route('/auth/reset/:token').post(userPassword.reset);
} else if (config.auth.strategy === 'proxy-pki') {
	/**
	 * Routes that only apply to the 'proxy-pki' passport strategy
	 */
	logger.info('Configuring proxy-pki user authentication routes.');

	// DN passed via header from proxy
	router.route('/auth/signup').post(userAuthentication.proxyPkiSignup);
}

export = router;
