'use strict';

const
	deps = require('../../../dependencies'),
	utilService = deps.utilService,

	resourcesService = require('./resources.service');

module.exports.searchTags = (req, res) => {
	// Get search and query parameters
	const search = req.body.s || null;
	const teamId = req.body.teamId || null;

	resourcesService.searchTagsInResources(teamId, search, req.query, req.user).then((result) => {
		res.status(200).json(result);
	}).catch((err) => {
		utilService.handleErrorResponse(res, err);
	});
};

module.exports.updateTag = (req, res) => {
	const teamId = req.body.teamId || null;
	const prevTagName = req.body.prev || null;
	const newTagName = req.body.updated || null;

	resourcesService.updateTagInResources(teamId, prevTagName, newTagName, req.user).then((result) => {
		res.status(200).json(result);
	}).catch((err) => {
		utilService.handleErrorResponse(res, err);
	});
};

module.exports.deleteTag = (req, res) => {
	const teamId = req.query.teamId || null;
	const tagName = req.query.tag || null;

	resourcesService.deleteTagFromResources(teamId, tagName, req.user).then((result) => {
		res.status(200).json(result);
	}).catch((err) => {
		utilService.handleErrorResponse(res, err);
	});
};
