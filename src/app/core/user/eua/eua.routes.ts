import { Router } from 'express';

import * as euas from './eua.controller';
import { hasAdminAccess, hasLogin } from '../user-auth.middleware';

/**
 * End User Agreement Routes
 */

const router = Router();

router.route('/euas').post(hasAdminAccess, euas.searchEuas);

router
	.route('/eua')
	.get(hasLogin, euas.getCurrentEua)
	.post(hasAdminAccess, euas.createEua);

router.route('/eua/accept').post(hasLogin, euas.acceptEua);

router
	.route('/eua/:euaId')
	.get(hasAdminAccess, euas.read)
	.post(hasAdminAccess, euas.updateEua)
	.delete(hasAdminAccess, euas.deleteEua);

router.route('/eua/:euaId/publish').post(hasAdminAccess, euas.publishEua);

// Finish by binding the user middleware
router.param('euaId', euas.euaById);

export = router;
