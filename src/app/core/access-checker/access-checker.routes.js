'use strict';

const express = require('express'),
	deps = require('../../../dependencies'),
	logger = deps.logger,
	user = require('../../core/user/user.controller'),
	accessChecker = require('./access-checker.controller');

/**
 * Routes that only apply to the 'proxy-pki' passport strategy
 */
logger.info('Configuring proxy-pki user authentication routes.');

const router = express.Router();

router
	.route('/access-checker/entry/:key')
	.post(user.hasAdminAccess, accessChecker.refreshEntry)
	.delete(user.hasAdminAccess, accessChecker.deleteEntry);

router
	.route('/access-checker/entries/search')
	.post(user.hasAdminAccess, accessChecker.searchEntries);

router
	.route('/access-checker/entries/match')
	.post(user.hasAdminAccess, accessChecker.matchEntries);

// Refresh current user
router
	.route('/access-checker/user')
	.post(user.has(user.requiresLogin), accessChecker.refreshCurrentUser);

module.exports = router;
