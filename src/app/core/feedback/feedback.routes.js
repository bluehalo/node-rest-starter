'use strict';

const express = require('express'),

	feedback = require('./feedback.controller'),
	user = require('../user/user.controller');


const router = express.Router();

/**
 * @swagger
 * definitions:
 *   Feedback:
 *     type: object
 *     properties:
 *       body:
 *          type: string
 *       url:
 *          type: string
 *       type:
 *          type: string
 *     example:
 *       body: 'This is a great tool! Thanks for building it.'
 *       url: 'http://localhost:3000/#/path/to/page'
 *       type: 'Bug'
 */

/**
 * @swagger
 * /feedback:
 *   post:
 *     produces:
 *       - application/json
 *     tags: [Feedback]
 *     description: >
 *       Echoes the feedback submitted, including the appended timestamp and user ID
 *     parameters:
 *       - in: body
 *         name: Feedback
 *         description: >
 *             The Feedback that is submitted by the user from some part
 *             of the application
 *         schema:
 *           $ref: '#/definitions/Feedback'
 *     responses:
 *       '200':
 *         description: Feedback was submitted successfully
 *         schema:
 *           $ref: '#/definitions/Feedback'
 *       '401':
 *         description: Anonymous user attempted to submit feedback
 *         schema:
 *           type: object
 *           properties:
 *             status:
 *               type: number
 *             type:
 *               type: string
 *             message:
 *               type: string
 *           example:
 *             status: 401
 *             type: 'no-login'
 *             message: 'User is not logged in'
 */
router.route('/feedback')
	.post(user.hasAccess, feedback.submitFeedback);

router.route('/admin/feedback')
	.post(user.hasAdminAccess, feedback.search);

router.route('/admin/feedback/csv/:exportId')
	.get(user.hasAdminAccess, feedback.adminGetFeedbackCSV);

module.exports = router;
