import { Router } from 'express';

import { hasAccess, hasAdminAccess } from '../user/user-auth.middleware';
import * as messages from './message.controller';

const router = Router();

// Create Message
router.route('/admin/message').post(hasAdminAccess, messages.create);

// Search messages
router.route('/messages').post(hasAccess, messages.search);

router.route('/messages/recent').post(hasAccess, messages.getRecentMessages);

// Dismiss a message
router.route('/messages/dismiss').post(hasAccess, messages.dismissMessage);

// Admin retrieve/update/delete
router
	.route('/admin/message/:msgId')
	.get(hasAccess, messages.read)
	.post(hasAdminAccess, messages.update)
	.delete(hasAdminAccess, messages.deleteMessage);

// Bind the message middleware
router.param('msgId', messages.messageById);

export = router;
