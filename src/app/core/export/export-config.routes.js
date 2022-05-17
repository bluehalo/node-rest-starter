'use strict';

const express = require('express'),
	{ Validator } = require('express-json-validator-middleware'),
	user = require('../user/user.controller'),
	exportConfig = require('./export-config.controller'),
	exportConfigSchemas = require('./export-config.schemas');

// @ts-ignore
const { validate } = new Validator();

const router = express.Router();

// Admin post CSV config parameters
router
	.route('/requestExport')
	.post(
		user.hasAccess,
		validate({ body: exportConfigSchemas.request }),
		exportConfig.requestExport
	);

module.exports = router;
