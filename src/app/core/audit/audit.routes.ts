import { Router } from 'express';

import { hasAuditorAccess } from '../user/user-auth.middleware';
import * as audit from './audit.controller';

const router = Router();

router.route('/audit').post(hasAuditorAccess, audit.search);

router
	.route('/audit/distinctValues')
	.get(hasAuditorAccess, audit.getDistinctValues);

export = router;
