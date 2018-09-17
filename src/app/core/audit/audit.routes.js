'use strict';

const
	express = require('express'),

	user = require('../user/user.controller'),
	audit = require('./audit.controller');


const router = express.Router();

router.route('/audit')
	.post(user.hasAuditorAccess, audit.search);

router.route('/audit/feedback')
	.post(user.hasAdminAccess, audit.search);

router.route('/audit/distinctValues')
	.get(user.hasAuditorAccess, audit.getDistinctValues);

module.exports = router;
