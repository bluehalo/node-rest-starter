import { Router } from 'express';

import user from '../user/user.controller';
import * as notifications from './notification.controller';

const router = Router();

router.route('/notifications').post(user.hasAccess, notifications.search);

export = router;
