import { Router } from 'express';
import { Validator } from 'express-json-validator-middleware';

import { hasAny } from '../../common/express/auth-middleware';
import {
	hasAccess,
	hasEditorAccess,
	requiresAdminRole
} from '../user/user-auth.middleware';
import * as teams from './teams.controller';
import * as teamSchemas from './teams.schemas';

const { validate } = new Validator({});

const router = Router();

/**
 * @swagger
 * /team:
 *   post:
 *     tags: [Team]
 *     description: Creates a new Team
 *     requestBody:
 *       $ref: '#/components/requestBodies/CreateTeam'
 *     responses:
 *       '200':
 *         $ref: '#/components/responses/CreatedTeam'
 */
router.route('/team').post(hasEditorAccess, teams.create);

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
router.route('/teams').post(hasAccess, teams.search);

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
router.route('/team/ancestors').post(hasAccess, teams.getAncestorTeamIds);

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
 *     requestBody:
 *       $ref: '#/components/requestBodies/UpdateTeam'
 *     responses:
 *       '200':
 *         $ref: '#/components/responses/UpdateTeam'
 *       '400':
 *         description: Update unsuccessful. Could not find team.
 *   delete:
 *     tags: [Team]
 *     description: Deletes a Team
 *     parameters:
 *       - $ref: '#/components/parameters/teamIdParam'
 *     responses:
 *       '200':
 *         $ref: '#/components/responses/DeleteTeam'
 *       '400':
 *         description: Deletion unsuccessful. Could not find team.
 */
router
	.route('/team/:teamId')
	.get(hasAccess, hasAny(requiresAdminRole, teams.requiresMember), teams.read)
	.post(hasAccess, hasAny(requiresAdminRole, teams.requiresAdmin), teams.update)
	.delete(
		hasAccess,
		hasAny(requiresAdminRole, teams.requiresAdmin),
		teams.deleteTeam
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
 *       '400':
 *         description: Request for team access unsuccessful. Could not find team.
 */
router.route('/team/:teamId/request').post(hasAccess, teams.requestAccess);

/**
 * @swagger
 * /team-request:
 *   post:
 *     tags: [Team]
 *     description: Requests a new Team. Notifies the team organization admin of the request.
 *     requestBody:
 *       $ref: '#/components/requestBodies/RequestNewTeam'
 *     responses:
 *       '204':
 *         $ref: '#/components/responses/RequestNewTeam'
 */
router.route('/team-request').post(hasAccess, teams.requestNewTeam);

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
 *       '400':
 *         description: Add unsuccessful. Could not find team or new members not specified.
 */
router
	.route('/team/:teamId/members')
	.put(
		hasAccess,
		hasAny(requiresAdminRole, teams.requiresAdmin),
		validate({ body: teamSchemas.addMembers }),
		teams.addMembers
	)
	.post(
		hasAccess,
		hasAny(requiresAdminRole, teams.requiresMember),
		teams.searchMembers
	);

/**
 * @swagger
 * /team/{teamId}/member/{memberId}:
 *   post:
 *     tags: [Team]
 *     description: Adds a member to a Team
 *     parameters:
 *       - $ref: '#/components/parameters/teamIdParam'
 *       - $ref: '#/components/parameters/memberIdParam'
 *     requestBody:
 *       $ref: '#/components/requestBodies/AddTeamMember'
 *     responses:
 *       '204':
 *         $ref: '#/components/responses/AddedTeamMember'
 *       '400':
 *         description: Add unsuccessful. Could not find team.
 *   delete:
 *     tags: [Team]
 *     description: Deletes a member from a team
 *     parameters:
 *       - $ref: '#/components/parameters/teamIdParam'
 *       - $ref: '#/components/parameters/memberIdParam'
 *     responses:
 *       '204':
 *         $ref: '#/components/responses/RemovedTeamMember'
 *       '400':
 *         description: Deletion unsuccessful. Could not find team.
 */
router
	.route('/team/:teamId/member/:memberId')
	.post(
		hasAccess,
		hasAny(requiresAdminRole, teams.requiresAdmin),
		validate({ body: teamSchemas.addUpdateMemberRole }),
		teams.addMember
	)
	.delete(
		hasAccess,
		hasAny(requiresAdminRole, teams.requiresAdmin),
		teams.removeMember
	);

/**
 * @swagger
 * /team/{teamId}/member/{memberId}/role:
 *   post:
 *     tags: [Team]
 *     description: Updates a member's role in a team.
 *     parameters:
 *       - $ref: '#/components/parameters/teamIdParam'
 *       - $ref: '#/components/parameters/memberIdParam'
 *     requestBody:
 *      $ref: '#/components/requestBodies/UpdateMemberRole'
 *     responses:
 *       '204':
 *         $ref: '#/components/responses/UpdatedTeamMemberRole'
 *       '400':
 *         description: Update unsuccessful. Could not find team.
 */
router
	.route('/team/:teamId/member/:memberId/role')
	.post(
		hasAccess,
		hasAny(requiresAdminRole, teams.requiresAdmin),
		validate({ body: teamSchemas.addUpdateMemberRole }),
		teams.updateMemberRole
	);

// Finish by binding the team middleware
router.param('teamId', teams.teamById);
router.param('memberId', teams.teamMemberById);

export = router;
