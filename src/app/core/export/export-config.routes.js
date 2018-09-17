'use strict';

const
	express = require('express'),

	user = require('../user/user.controller'),
	exportConfig = require('./export-config.controller');


const router = express.Router();

// Admin post CSV config parameters
router.route('/requestExport')
	.post(user.hasAccess, exportConfig.requestExport);

module.exports = router;
