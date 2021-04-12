'use strict';

const express = require('express'),
	user = require('../user/user.controller'),
	resources = require('./resources.controller');

const router = express.Router();

router
	.route('/resources/tags/search')
	.post(user.hasAccess, resources.searchTags);

router
	.route('/resources/tags')
	.post(user.hasAccess, resources.updateTag)
	.delete(user.hasAccess, resources.deleteTag);

module.exports = router;
