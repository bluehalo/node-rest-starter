'use strict';

const express = require('express'),
	feedback = require('./feedback.controller'),
	user = require('../user/user.controller');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Feedback:
 *       type: object
 *       properties:
 *         body:
 *           type: string
 *         url:
 *           type: string
 *         type:
 *           type: string
 *       example:
 *         body: 'This is a great tool! Thanks for building it.'
 *         url: 'http://localhost:3000/#/path/to/page'
 *         type: 'Bug'
 */

/**
 * @swagger
 * /feedback:
 *   post:
 *     tags: [Feedback]
 *     description: >
 *       Echoes the feedback submitted, including the appended timestamp and user ID
 *     requestBody:
 *       description: >
 *             The Feedback that is submitted by the user from some part
 *             of the application
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Feedback'
 *     responses:
 *       '200':
 *         description: Feedback was submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Feedback'
 *       '401':
 *         description: Anonymous user attempted to submit feedback
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                 type:
 *                   type: string
 *                 message:
 *                   type: string
 *               example:
 *                 status: 401
 *                 type: 'no-login'
 *                 message: 'User is not logged in'
 */
router
	.route('/feedback')
	.post(user.has(user.requiresLogin), feedback.submitFeedback);

router.route('/admin/feedback').post(user.hasAdminAccess, feedback.search);

/**
 * @swagger
 * /admin/feedback/{feedbackId}/status:
 *   patch:
 *     tags: [Feedback]
 *     description: >
 *       Updates the status of the feedback with the supplied ID
 *     requestBody:
 *       description: >
 *             The value to update the Feedback status to
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Feedback status was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Feedback'
 *       '400':
 *         description: User attempted to update feedback with invalid ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                 type:
 *                   type: string
 *                 message:
 *                   type: string
 *               example:
 *                 status: 400
 *                 type: 'validation'
 *                 message: 'Invalid feedback ID'
 *       '401':
 *         description: Anonymous user attempted to update feedback status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                 type:
 *                   type: string
 *                 message:
 *                   type: string
 *               example:
 *                 status: 401
 *                 type: 'no-login'
 *                 message: 'User is not logged in'
 *       '404':
 *         description: Unable to find feedback with the supplied ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                 type:
 *                   type: string
 *                 message:
 *                   type: string
 *               example:
 *                 status: 404
 *                 type: 'not-found'
 *                 message: 'Could not find feedback'
 */
router
	.route('/admin/feedback/:feedbackId/status')
	.patch(user.hasAdminAccess, feedback.updateFeedbackStatus);

/**
 * @swagger
 * /admin/feedback/{feedbackId}/assignee:
 *   patch:
 *     tags: [Feedback]
 *     description: >
 *       Updates the assignee of the feedback with the supplied ID
 *     requestBody:
 *       description: >
 *             The username to update the Feedback assignee to
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assignee:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Feedback assignee was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Feedback'
 *       '400':
 *         description: User attempted to update feedback with invalid ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                 type:
 *                   type: string
 *                 message:
 *                   type: string
 *               example:
 *                 status: 400
 *                 type: 'validation'
 *                 message: 'Invalid feedback ID'
 *       '401':
 *         description: Anonymous user attempted to update feedback assignee
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                 type:
 *                   type: string
 *                 message:
 *                   type: string
 *               example:
 *                 status: 401
 *                 type: 'no-login'
 *                 message: 'User is not logged in'
 *       '404':
 *         description: Unable to find feedback with the supplied ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                 type:
 *                   type: string
 *                 message:
 *                   type: string
 *               example:
 *                 status: 404
 *                 type: 'not-found'
 *                 message: 'Could not find feedback'
 */
router
	.route('/admin/feedback/:feedbackId/assignee')
	.patch(user.hasAdminAccess, feedback.updateFeedbackAssignee);

router
	.route('/admin/feedback/csv/:exportId')
	.get(user.hasAdminAccess, feedback.adminGetFeedbackCSV);

router.param('feedbackId', feedback.feedbackById);

module.exports = router;
