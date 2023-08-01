import { Router } from 'express';

import * as accessChecker from './access-checker.controller';
import { logger } from '../../../dependencies';
import { hasAdminAccess, hasLogin } from '../user/user-auth.middleware';

/**
 * Routes that only apply to the 'proxy-pki' passport strategy
 */
logger.info('Configuring proxy-pki user authentication routes.');

const router = Router();

/**
 * @swagger
 *
 * /access-checker/entry/{key}:
 *   post:
 *     tags: ['Access Checker']
 *     description: Trigger cache entry refresh
 *     parameters:
 *       - $ref: '#/components/parameters/keyParam'
 *     responses:
 *       '204':
 *         description: Cache entry refresh was submitted successfully
 *       '400':
 *         $ref: '#/components/responses/NotAuthenticated'
 *   delete:
 *     tags: ['Access Checker']
 *     description: Delete cache entry
 *     parameters:
 *       - $ref: '#/components/parameters/keyParam'
 *     responses:
 *       '204':
 *         description: Cache entry refresh was submitted deleted
 *       '400':
 *         $ref: '#/components/responses/NotAuthenticated'
 */
router
	.route('/access-checker/entry/:key')
	.post(hasAdminAccess, accessChecker.refreshEntry)
	.delete(hasAdminAccess, accessChecker.deleteEntry);

router
	.route('/access-checker/entries/match')
	.post(hasAdminAccess, accessChecker.matchEntries);

// Refresh current user
router
	.route('/access-checker/user')
	.post(hasLogin, accessChecker.refreshCurrentUser);

export = router;
