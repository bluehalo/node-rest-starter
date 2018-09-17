'use strict';

const
	express = require('express'),

	notifications = require('./notification.controller'),
	user = require('../user/user.controller');

const router = express.Router();

router.route('/notifications')
	.post(user.hasAccess, notifications.search);

module.exports = router;
