'use strict';

const express = require('express'),
	feedback = require('./feedback.controller'),
	user = require('../user/user.controller');

const router = express.Router();

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
 *             $ref: '#/components/schemas/FeedbackCreate'
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
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               status: 401
 *               type: 'no-login'
 *               message: 'User is not logged in'
 */
router
	.route('/feedback')
	.post(user.has(user.requiresLogin), feedback.submitFeedback);

/**
 * @swagger
 * /admin/feedback:
 *   post:
 *     tags: [Feedback]
 *     description: >
 *       returns feedback matching search criteria
 *     requestBody:
 *       $ref: '#/components/requestBodies/SearchCriteria'
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/sizeParam'
 *       - $ref: '#/components/parameters/sortParam'
 *       - $ref: '#/components/parameters/dirParam'
 *     responses:
 *       '200':
 *         description: Feedback returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeedbackPage'
 *       '400':
 *         $ref: '#/components/responses/NotAuthenticated'
 */
router.route('/admin/feedback').post(user.hasAdminAccess, feedback.search);

/**
 * @swagger
 * /admin/feedback/{feedbackId}/status:
 *   patch:
 *     tags: [Feedback]
 *     description: >
 *       Updates the status of the feedback with the supplied ID
 *     parameters:
 *       - $ref: '#/components/parameters/feedbackIdParam'
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
 *                 enum: [New, Open, Closed]
 *     responses:
 *       '200':
 *         description: Feedback status was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Feedback'
 *       '400':
 *         $ref: '#/components/responses/FeedbackUpdateInvalidId'
 *       '401':
 *         $ref: '#/components/responses/FeedbackUpdateAnonymousUser'
 *       '404':
 *         $ref: '#/components/responses/FeedbackNotFound'
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
 *     parameters:
 *       - $ref: '#/components/parameters/feedbackIdParam'
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
 *         $ref: '#/components/responses/FeedbackUpdateInvalidId'
 *       '401':
 *         $ref: '#/components/responses/FeedbackUpdateAnonymousUser'
 *       '404':
 *         $ref: '#/components/responses/FeedbackNotFound'
 */
router
	.route('/admin/feedback/:feedbackId/assignee')
	.patch(user.hasAdminAccess, feedback.updateFeedbackAssignee);

router
	.route('/admin/feedback/csv/:exportId')
	.get(user.hasAdminAccess, feedback.adminGetFeedbackCSV);

router.param('feedbackId', feedback.feedbackById);

module.exports = router;
