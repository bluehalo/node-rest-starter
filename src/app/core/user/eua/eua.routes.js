'use strict';

const express = require('express'),
	users = require('../user.controller');

/**
 * End User Agreement Routes
 */

const router = express.Router();

router.route('/euas').post(users.hasAdminAccess, users.searchEuas);

router
	.route('/eua/accept')
	.post(users.has(users.requiresLogin), users.acceptEua);

router
	.route('/eua/:euaId/publish')
	.post(users.hasAdminAccess, users.publishEua);

router
	.route('/eua/:euaId')
	.get(users.hasAdminAccess, users.read)
	.post(users.hasAdminAccess, users.updateEua)
	.delete(users.hasAdminAccess, users.deleteEua);

router
	.route('/eua')
	.get(users.has(users.requiresLogin), users.getCurrentEua)
	.post(users.hasAdminAccess, users.createEua);

// Finish by binding the user middleware
router.param('euaId', users.euaById);

module.exports = router;
