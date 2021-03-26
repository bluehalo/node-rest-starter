'use strict';

const express = require('express'),
	teams = require('./teams.controller'),
	user = require('../user/user.controller');

/**
 * Team Routes
 */

const router = express.Router();

router.route('/team').put(user.hasEditorAccess, teams.create);

router.route('/teams').post(user.hasAccess, teams.search);

router
	.route('/team/:teamId')
	.get(
		user.hasAccess,
		user.hasAny(user.requiresAdminRole, teams.requiresMember),
		teams.read
	)
	.post(
		user.hasAccess,
		user.hasAny(user.requiresAdminRole, teams.requiresAdmin),
		teams.update
	)
	.delete(
		user.hasAccess,
		user.hasAny(user.requiresAdminRole, teams.requiresAdmin),
		teams.delete
	);

router.route('/team/:teamId/request').post(user.hasAccess, teams.requestAccess);

router.route('/team-request').post(user.hasAccess, teams.requestNewTeam);

/**
 * Team editors Routes (requires team admin role)
 */
router
	.route('/team/:teamId/members')
	.put(
		user.hasAccess,
		user.hasAny(user.requiresAdminRole, teams.requiresAdmin),
		teams.addMembers
	)
	.post(
		user.hasAccess,
		user.hasAny(user.requiresAdminRole, teams.requiresMember),
		teams.searchMembers
	);

router
	.route('/team/:teamId/member/:memberId')
	.post(
		user.hasAccess,
		user.hasAny(user.requiresAdminRole, teams.requiresAdmin),
		teams.addMember
	)
	.delete(
		user.hasAccess,
		user.hasAny(user.requiresAdminRole, teams.requiresAdmin),
		teams.removeMember
	);

router
	.route('/team/:teamId/member/:memberId/role')
	.post(
		user.hasAccess,
		user.hasAny(user.requiresAdminRole, teams.requiresAdmin),
		teams.updateMemberRole
	);

// Finish by binding the team middleware
router.param('teamId', teams.teamById);
router.param('memberId', teams.teamMemberById);

module.exports = router;
