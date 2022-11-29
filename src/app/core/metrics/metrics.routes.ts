import { Router } from 'express';

import * as metrics from './metrics.controller';

const router = Router();

// For now, just a single get for the global client configuration
router.route('/client-metrics').post(metrics.handleEvent);

export = router;
