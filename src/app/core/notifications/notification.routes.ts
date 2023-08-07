import { Router } from 'express';

import * as notifications from './notification.controller';
import { hasAccess } from '../user/user-auth.middleware';

const router = Router();

router.route('/notifications').post(hasAccess, notifications.search);

export = router;
