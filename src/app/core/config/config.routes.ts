import { Router } from 'express';

import * as config from './config.controller';

const router = Router();

// For now, just a single get for the global client configuration
router.route('/config').get(config.read);

export = router;
