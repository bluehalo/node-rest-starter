import { Router } from 'express';

import { logger } from '../../../dependencies';
import user from '../../core/user/user.controller';
import * as accessChecker from './access-checker.controller';

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
	.post(user.hasAdminAccess, accessChecker.refreshEntry)
	.delete(user.hasAdminAccess, accessChecker.deleteEntry);

router
	.route('/access-checker/entries/match')
	.post(user.hasAdminAccess, accessChecker.matchEntries);

// Refresh current user
router
	.route('/access-checker/user')
	.post(user.has(user.requiresLogin), accessChecker.refreshCurrentUser);

export = router;
