import { Router } from 'express';

import user from '../user/user.controller';
import * as audit from './audit.controller';

const router = Router();

router.route('/audit').post(user.hasAuditorAccess, audit.search);

router
	.route('/audit/distinctValues')
	.get(user.hasAuditorAccess, audit.getDistinctValues);

module.exports = router;
