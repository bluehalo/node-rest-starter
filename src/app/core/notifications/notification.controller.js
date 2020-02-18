'use strict';

const
	deps = require('../../../dependencies'),
	util = deps.utilService,

	notificationsService = require('./notification.service');

module.exports.search = function(req, res) {
	// Get search and query parameters
	const query = req.body.q || {};

	notificationsService.search(query, req.query, req.user)
		.then(
			(result) => {
				res.status(200).json(result);
			},
			(err) => {
				util.handleErrorResponse(res, err);
			})
		.done();
};
