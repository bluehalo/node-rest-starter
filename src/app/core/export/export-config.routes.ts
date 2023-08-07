import express from 'express';
import { Validator } from 'express-json-validator-middleware';

import * as exportConfig from './export-config.controller';
import { exportConfigSchema } from './export-config.schemas';
import { hasAccess } from '../user/user-auth.middleware';

const { validate } = new Validator({});

const router = express.Router();

// Admin post CSV config parameters
router
	.route('/requestExport')
	.post(
		hasAccess,
		validate({ body: exportConfigSchema }),
		exportConfig.requestExport
	);

export = router;
