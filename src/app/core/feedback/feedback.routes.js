'use strict';

const express = require('express'),

	feedback = require('./feedback.controller'),
	user = require('../user/user.controller');


let router = express.Router();

router.route('/feedback')
	.post(user.hasAccess, feedback.submitFeedback);

router.route('/admin/feedback')
	.post(user.hasAdminAccess, feedback.search);

router.route('/admin/feedback/csv/:exportId')
	.get(user.hasAdminAccess, feedback.adminGetFeedbackCSV);

module.exports = router;
