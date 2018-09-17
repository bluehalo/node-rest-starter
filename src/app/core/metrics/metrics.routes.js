'use strict';

const
	express = require('express'),

	metrics = require('./metrics.controller');


const router = express.Router();

// For now, just a single get for the global client configuration
router.route('/client-metrics')
	.post(metrics.handleEvent);

module.exports = router;
