'use strict';

const express = require('express'),
	user = require('../user/user.controller'),
	messages = require('./message.controller');

const router = express.Router();

// Create Message
router.route('/admin/message').post(user.hasAdminAccess, messages.create);

// Search messages
router.route('/messages').post(user.hasAccess, messages.search);

router
	.route('/messages/recent')
	.post(user.hasAccess, messages.getRecentMessages);

// Dismiss a message
router.route('/messages/dismiss').post(user.hasAccess, messages.dismissMessage);

// Admin retrieve/update/delete
router
	.route('/admin/message/:msgId')
	.get(user.hasAccess, messages.read)
	.post(user.hasAdminAccess, messages.update)
	.delete(user.hasAdminAccess, messages.delete);

// Bind the message middleware
router.param('msgId', messages.messageById);

module.exports = router;
