'use strict';

const resourcesService = require('./resources.service');

module.exports.searchTags = async (req, res) => {
	// Get search and query parameters
	const search = req.body.s ?? null;
	const teamId = req.body.teamId ?? null;

	const result = await resourcesService.searchTagsInResources(
		teamId,
		search,
		req.query,
		req.user
	);
	res.status(200).json(result);
};

module.exports.updateTag = async (req, res) => {
	const teamId = req.body.teamId ?? null;
	const prevTagName = req.body.prev ?? null;
	const newTagName = req.body.updated ?? null;

	const result = await resourcesService.updateTagInResources(
		teamId,
		prevTagName,
		newTagName,
		req.user
	);
	res.status(200).json(result);
};

module.exports.deleteTag = async (req, res) => {
	const teamId = req.query.teamId ?? null;
	const tagName = req.query.tag ?? null;

	const result = await resourcesService.deleteTagFromResources(
		teamId,
		tagName,
		req.user
	);
	res.status(200).json(result);
};
