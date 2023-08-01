import { Router } from 'express';

import * as audit from './audit.controller';
import { hasAuditorAccess } from '../user/user-auth.middleware';

const router = Router();

router.route('/audit').post(hasAuditorAccess, audit.search);

router
	.route('/audit/distinctValues')
	.get(hasAuditorAccess, audit.getDistinctValues);

export = router;
