import { Router } from 'express';

import * as users from '../user.controller';
import * as euas from './eua.controller';

/**
 * End User Agreement Routes
 */

const router = Router();

router.route('/euas').post(users.hasAdminAccess, euas.searchEuas);

router
	.route('/eua')
	.get(users.has(users.requiresLogin), euas.getCurrentEua)
	.post(users.hasAdminAccess, euas.createEua);

router
	.route('/eua/accept')
	.post(users.has(users.requiresLogin), euas.acceptEua);

router
	.route('/eua/:euaId')
	.get(users.hasAdminAccess, euas.read)
	.post(users.hasAdminAccess, euas.updateEua)
	.delete(users.hasAdminAccess, euas.deleteEua);

router.route('/eua/:euaId/publish').post(users.hasAdminAccess, euas.publishEua);

// Finish by binding the user middleware
router.param('euaId', euas.euaById);

export = router;
