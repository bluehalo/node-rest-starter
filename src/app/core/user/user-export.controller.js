'use strict';

const _ = require('lodash'),
	{ config, dbs, auditService } = require('../../../dependencies'),
	Team = dbs.admin.model('Team'),
	TeamMember = dbs.admin.model('TeamUser'),
	ExportConfig = dbs.admin.model('ExportConfig'),
	exportConfigController = require('../export/export-config.controller'),
	exportConfigService = require('../export/export-config.service');

// GET the requested CSV using a special configuration from the export config collection
module.exports.adminGetCSV = async (req, res) => {
	const exportId = req.params.exportId;

	const result = await exportConfigService.getConfigById(exportId);

	if (null == result) {
		return Promise.reject({
			status: 404,
			type: 'bad-argument',
			message: 'Export configuration not found. Document may have expired.'
		});
	}

	auditService.audit(
		`${result.type} CSV config retrieved`,
		'export',
		'export',
		req,
		ExportConfig.auditCopy(result)
	);

	const columns = result.config.cols,
		query = result.config.q ? JSON.parse(result.config.q) : null,
		search = result.config.s,
		sort = { [result.config.sort]: result.config.dir },
		fileName = `${config.app.instanceName}-${result.type}.csv`;
	let userData = [],
		teamTitleMap = {},
		isTeamRequested = false;

	// Based on which columns are requested, handle property-specific behavior (ex. callbacks for the
	// CSV service to make booleans and dates more human-readable)
	columns.forEach((col) => {
		switch (col.key) {
			case 'roles.user':
			case 'roles.editor':
			case 'roles.auditor':
			case 'roles.admin':
			case 'bypassAccessCheck':
				col.callback = (value) => {
					return value ? 'true' : '';
				};
				break;
			case 'lastLogin':
			case 'created':
			case 'updated':
			case 'acceptedEua':
				col.callback = (value) => {
					return value ? value.toISOString() : '';
				};
				break;
			case 'teams':
				isTeamRequested = true;
				break;
		}
	});

	const teamResults = await TeamMember.find(query)
		.textSearch(search)
		.sort(sort)
		.exec()
		.then((userResult) => {
			// Process user data to be usable for CSV
			userData = (userResult || []).map((user) => TeamMember.fullCopy(user));

			if (isTeamRequested) {
				let teamIds = [];
				userData.forEach((user) => {
					teamIds = teamIds.concat(user.teams.map((t) => t._id));
				});
				return Team.find({ _id: { $in: teamIds } }).exec();
			}
			return Promise.resolve();
		});

	if (null != teamResults) {
		teamTitleMap = _.keyBy(teamResults, '_id');

		// Convert user.groups to human readable groups string
		userData.forEach((user) => {
			const teamNames = user.teams.map((t) => {
				return _.has(teamTitleMap, t._id)
					? teamTitleMap[t._id].name
					: '<missing>';
			});

			// Formatted team name string, ex. "Group 1, SomeDev, Test Group"
			user.teams = teamNames.join(', ');
		});
	}

	exportConfigController.exportCSV(req, res, fileName, columns, userData);
};
