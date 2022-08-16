'use strict';

const notificationsService = require('./notification.service');

module.exports.search = async (req, res) => {
	// Get search and query parameters
	const query = req.body.q ?? {};

	const result = await notificationsService.search(query, req.query, req.user);
	res.status(200).json(result);
};
