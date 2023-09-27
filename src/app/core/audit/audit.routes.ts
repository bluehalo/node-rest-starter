import { Router } from 'express';

import * as audit from './audit.controller';
import { exportConfigById } from '../export/export-config.controller';
import { hasAuditorAccess } from '../user/user-auth.middleware';

const router = Router();

router.route('/audit').post(hasAuditorAccess, audit.search);

router.route('/audit/csv/:exportId').get(audit.getCSV);

router
	.route('/audit/distinctValues')
	.get(hasAuditorAccess, audit.getDistinctValues);

router.param('exportId', exportConfigById);

export = router;
