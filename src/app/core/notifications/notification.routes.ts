import { Router } from 'express';

import { hasAccess } from '../user/user-auth.middleware';
import * as notifications from './notification.controller';

const router = Router();

router.route('/notifications').post(hasAccess, notifications.search);

export = router;
