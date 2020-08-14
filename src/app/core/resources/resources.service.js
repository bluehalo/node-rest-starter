'use strict';

const
	_ = require('lodash'),
	mongoose = require('mongoose'),

	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	util = deps.utilService,
	Resource = dbs.admin.model('Resource'),
	Team = dbs.admin.model('Team'),
	User = dbs.admin.model('User'),

	teamsController = require('../teams/teams.controller');

function populateOwnerAndCreatorInfo(search) {
	search = search.toObject();

	let ownerPromise;

	if (null == search.owner || search.owner.type !== 'team') {
		ownerPromise = Promise.resolve(search);
	}
	else {
		const ownerId = _.isString(search.owner.id) ? mongoose.Types.ObjectId(search.owner.id) : search.owner.id;
		ownerPromise = Team.findOne({ _id: ownerId }).exec().then((ownerObj) => {
			if (null != ownerObj) {
				search.owner.name = ownerObj.name;
			}
			return search;
		});
	}

	return ownerPromise.then((s) => {
		if (null == s.creator) {
			return Promise.resolve(s);
		}
		else {
			const creatorId = _.isString(s.creator) ? mongoose.Types.ObjectId(s.creator) : s.creator;
			return User.findOne({ _id: creatorId }).exec().then((creatorObj) => {
				if (null != creatorObj) {
					s.creatorName = creatorObj.name;
					s.creatorId = creatorId;
				}
				return s;
			});
		}
	});
}

function populateMultiOwnerAndCreatorInfo(searches) {
	return Promise.all(searches.map((search) => populateOwnerAndCreatorInfo(search)));
}

function doSearch(query, sortParams, page, limit) {
	const offset = page * limit;

	return Promise.all([
		Resource.find(query).countDocuments().exec(),
		Resource.find(query).sort(sortParams).collation({caseLevel: true, locale: 'en'}).skip(offset).limit(limit).exec()
	]).then(([countResult, searchResult]) => {
		return util.getPagingResults(limit, page, countResult, searchResult);
	});
}

function searchResources(query, queryParams, user) {
	const page = util.getPage(queryParams);
	const limit = util.getLimit(queryParams, 1000);

	const sort = queryParams.sort;
	let dir = queryParams.dir;

	// Sort can be null, but if it's non-null, dir defaults to DESC
	if (null != sort && dir == null) { dir = 'ASC'; }

	let sortParams;
	if (null != sort) {
		sortParams = {};
		sortParams[sort] = dir === 'ASC' ? 1 : -1;
	}

	let searchPromise;
	// If user is not an admin, constrain the results to the user's teams
	if (null == user.roles || !user.roles.admin) {
		searchPromise = teamsController.filterTeamIds(user).then((teamIds) => {
			teamIds = teamIds.map((teamId) => _.isString(teamId) ? mongoose.Types.ObjectId(teamId) : teamId);

			query.$or = [
				{ 'owner.type': 'team', 'owner._id': { $in: teamIds }},
				{ 'owner.type': 'user', 'owner._id': user._id }
			];

			return doSearch(query, sortParams, page, limit);
		});
	}
	else {
		searchPromise = doSearch(query, sortParams, page, limit);
	}

	return searchPromise.then((results) => {
		return populateMultiOwnerAndCreatorInfo(results.elements).then((populated) => {
			results.elements = populated;
			return results;
		});
	});
}

function doSearchTags(countAggregation, resultAggregation, page, limit) {
	return Promise.all([
		Resource.aggregate(countAggregation),
		Resource.aggregate(resultAggregation)
	]).then((results) => {
		const totalSize = _.get(results, '[0][0].total', 0);
		const elements = results[1].map((result) => result._id);
		return util.getPagingResults(limit, page, totalSize, elements);
	});
}

function constrainTagResults(teamId, user, aggregation = true) {
	if (null != teamId) {
		const teamQuery = { 'owner._id': mongoose.Types.ObjectId(teamId) };
		// Constrain to specific team
		return Promise.resolve((aggregation) ? [{ $match: teamQuery }] : teamQuery);
	}
	else if (null == user.roles || !user.roles.admin) {
		// If user is not admin, constrain results to user's teams
		return teamsController.filterTeamIds(user).then((teamIds) => {
			teamIds = teamIds.map((_teamId) => _.isString(_teamId) ? mongoose.Types.ObjectId(_teamId): _teamId);

			const query = { $or: [
				{ 'owner.type': 'team', 'owner._id': { $in: teamIds }},
				{ 'owner.type': 'user', 'owner._id': user._id }
			]};

			return Promise.resolve((aggregation) ? [{ $match: query }] : query);
		});
	}
	else {
		return Promise.resolve((aggregation) ? [] : {});
	}
}

function searchTagsInResources(teamId, search, queryParams, user) {
	const page = util.getPage(queryParams);
	const limit = util.getLimit(queryParams, 1000);
	const offset = page * limit;

	const sortDir = queryParams.dir || 'ASC';

	// Build the aggregation pipeline
	const aggregationPipeline = [];

	// Constrain results
	return constrainTagResults(teamId, user).then((constrainPipeline) => {
		aggregationPipeline.push(...aggregationPipeline, ...constrainPipeline);

		aggregationPipeline.push(
			...aggregationPipeline,
			{ $unwind: '$tags' },
			{ $group: { _id: '$tags' } }
		);

		if (null != search) {
			aggregationPipeline.push({ $match: { _id: new RegExp(search, 'i') } });
		}

		const countAggregation = aggregationPipeline.concat([
			{$group: {_id: null, total: { $sum: 1} } }
		]);

		const resultAggregation = aggregationPipeline.concat([
			{ $sort: { _id: sortDir === 'ASC' ? 1 : -1 } },
			{ $skip: offset },
			{ $limit: limit }
		]);

		return doSearchTags(countAggregation, resultAggregation, page, limit);
	});
}

function updateTagInResources(teamId, tagName, newTagName, user) {
	if (null == tagName) {
		return Promise.reject({status: 404, message: 'Invalid tag name'});
	}

	if (null == newTagName) {
		return Promise.reject({status: 404, message: 'Cannot set tag name to null'});
	}

	let finalQuery;
	return constrainTagResults(teamId, user, false).then((query) => {
		finalQuery = {
			$and: [
				query,
				{ tags: { $in: [ tagName ] } }
			]
		};
		return Resource.updateMany(finalQuery, { $addToSet: { tags: newTagName } }).exec();
	}).then(() => {
		return Resource.updateMany(finalQuery, { $pull: { tags: tagName } }).exec();
	});
}

function deleteTagFromResources(teamId, tagName, user) {
	if (null == tagName) {
		return Promise.reject({status: 404, message: 'Invalid tag name'});
	}

	return constrainTagResults(teamId, user, false).then((query) => {
		return Resource.updateMany(query, { $pull: { tags: tagName } }).exec();
	});
}

function filterResourcesByAccess(ids, user) {
	if (!_.isArray(ids)) {
		return Promise.resolve([]);
	}
	else if (null == user.roles || user.roles.admin !== true) {
		// If user is not admin, perform the filtering
		return teamsController.filterTeamIds(user).then((teamIds) => {
			// Get teams user has belongs to
			teamIds = teamIds.map((teamId) => _.isString(teamId) ? mongoose.Types.ObjectId(teamId): teamId);

			const query = {
				$and: [
					{ _id: { $in: ids } },
					{ $or: [
						{'owner.type': 'team', 'owner._id': {$in: teamIds}},
						{'owner.type': 'user', 'owner._id': user._id}
					]}
				]
			};

			return Resource.find(query).exec();
		}).then((resources) => {
			return (null != resources) ? Promise.resolve(resources.map((resource) => resource._id)) : Promise.resolve([]);
		});
	}
	else {
		return Promise.resolve(ids);
	}
}

function resourceById(id) {
	return Resource.findOne({ _id: id }).exec();
}

function find(filter, projection, lean) {
	let query = Resource.find(filter, projection);
	if (lean) {
		query = query.lean();
	}
	return query.exec();
}

const deleteResourcesWithOwner = (ownerId, ownerType) => {
	return Resource.deleteMany({ 'owner.type': ownerType, 'owner._id': ownerId }).exec();
};

module.exports = {
	searchResources,
	searchTagsInResources,
	updateTagInResources,
	deleteTagFromResources,
	filterResourcesByAccess,
	resourceById,
	find,
	populateOwnerAndCreatorInfo,
	deleteResourcesWithOwner
};
