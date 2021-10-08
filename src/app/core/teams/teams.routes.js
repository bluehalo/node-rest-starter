'use strict';

const express = require('express'),
	teams = require('./teams.controller'),
	user = require('../user/user.controller');

/**
 * Team Routes
 */

const router = express.Router();

/**
 * @swagger
 * /team:
 *   put:
 *     tags: [Team]
 *     description: Creates a new Team
 *     requestBody:
 *       $ref: '#/components/requestBodies/CreateTeam'
 *     responses:
 *       '200':
 *         $ref: '#/components/responses/CreatedTeam'
 */
router.route('/team').put(user.hasEditorAccess, teams.create);

/**
 * @swagger
 * /teams:
 *   post:
 *     tags: [Team]
 *     description: Returns Teams that match the search criteria
 *     requestBody:
 *       $ref: '#/components/requestBodies/SearchCriteria'
 *     responses:
 *       '200':
 *         $ref: '#/components/responses/TeamListing'
 */
router.route('/teams').post(user.hasAccess, teams.search);

/**
 * @swagger
 * /team/ancestors:
 *   post:
 *     tags: [Team]
 *     description: Returns IDs of Ancestor Teams to any of the input teams
 *     requestBody:
 *       $ref: '#/components/requestBodies/GetAncestorTeams'
 *     responses:
 *       '200':
 *         $ref: '#/components/responses/TeamIds'
 */
router.route('/team/ancestors').post(user.hasAccess, teams.getAncestorTeamIds);

/**
 * @swagger
 * /team/{teamId}:
 *   get:
 *     tags: [Team]
 *     description: Gets the details of a Team
 *     parameters:
 *       - $ref: '#/components/parameters/teamIdParam'
 *     responses:
 *       '200':
 *         $ref: '#/components/responses/GetTeam'
 *   post:
 *     tags: [Team]
 *     description: Updates the details of a Team
 *     parameters:
 *       - $ref: '#/components/parameters/teamIdParam'
 *     responses:
 *       '200':
 *         $ref: '#/components/responses/UpdateTeam'
 *   delete:
 *     tags: [Team]
 *     description: Deletes a Team
 *     parameters:
 *       - $ref: '#/components/parameters/teamIdParam'
 *     responses:
 *       '200':
 *         $ref: '#/components/responses/DeleteTeam'
 */
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

/**
 * @swagger
 * /team/{teamId}/request:
 *   post:
 *     tags: [Team]
 *     description: Requests access to a Team. Notifies team admins of the request
 *     parameters:
 *       - $ref: '#/components/parameters/teamIdParam'
 *     responses:
 *       '204':
 *         $ref: '#/components/responses/RequestTeamAccess'
 */
router.route('/team/:teamId/request').post(user.hasAccess, teams.requestAccess);

router.route('/team-request').post(user.hasAccess, teams.requestNewTeam);

/**
 * Team editors Routes (requires team admin role)
 */
/**
 * @swagger
 * /team/{teamId}/members:
 *   put:
 *     tags: [Team]
 *     description: Adds members to a Team
 *     parameters:
 *       - $ref: '#/components/parameters/teamIdParam'
 *     requestBody:
 *       $ref: '#/components/requestBodies/AddTeamMembers'
 *     responses:
 *       '204':
 *         $ref: '#/components/responses/AddedTeamMembers'
 *   post:
 *     tags: [Team]
 *     description: Searches for members of team
 *     parameters:
 *       - $ref: '#/components/parameters/teamIdParam'
 *     requestBody:
 *       $ref: '#/components/requestBodies/SearchCriteria'
 *     responses:
 *       '200':
 *         $ref: '#/components/responses/TeamMembers'
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
