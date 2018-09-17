'use strict';

const
	express = require('express'),

	config = require('./config.controller');


const router = express.Router();

// For now, just a single get for the global client configuration
router.route('/config')
	.get(config.read);

module.exports = router;
