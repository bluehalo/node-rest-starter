'use strict';

const
	_ = require('lodash'),
	q = require('q'),

	deps = require('../../../dependencies'),
	config = deps.config,
	dbs = deps.dbs,
	utilService = deps.utilService,
	auditService = deps.auditService,

	Team = dbs.admin.model('Team'),
	TeamMember = dbs.admin.model('TeamUser'),
	ExportConfig = dbs.admin.model('ExportConfig'),

	exportConfigController = require('../export/export-config.controller'),
	exportConfigService = require('../export/export-config.service');


// GET the requested CSV using a special configuration from the export config collection
exports.adminGetCSV = (req, res) => {
	let exportId = req.params.exportId;

	exportConfigService.getConfigById(exportId)
		.then((result) => {
			if (null == result) {
				return q.reject({
					status: 404,
					type: 'bad-argument',
					message: 'Export configuration not found. Document may have expired.'
				});
			}

			return auditService.audit(`${result.type} CSV config retrieved`, 'export', 'export', TeamMember.auditCopy(req.user), ExportConfig.auditCopy(result), req.headers).then(() => {
					return q(result);
				});
		})
		.then((result) => {
			let userData = [],
				columns = result.config.cols,
				query = (result.config.q) ? JSON.parse(result.config.q) : null,
				search = result.config.s,
				sortArr = [{property: result.config.sort, direction: result.config.dir}],
				fileName = config.app.instanceName + '-' + result.type + '.csv',
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
							return (value) ? 'true' : '';
						};
						break;
					case 'lastLogin':
					case 'created':
					case 'updated':
					case 'acceptedEua':
						col.callback = (value) => {
							return (value) ? new Date(value).toISOString() : '';
						};
						break;
					case 'teams':
						isTeamRequested = true;
						break;
				}
			});

			return TeamMember.search(query, search, null, null, sortArr)
				.then((userResult) => {
					// Process user data to be usable for CSV
					userData = (null != userResult.results) ? userResult.results.map((user) => {
						return TeamMember.fullCopy(user);
					}) : [];

					if (isTeamRequested) {
						let teamIds = [];
					userData.forEach((user) => {
							teamIds = teamIds.concat(user.teams.map((t) => { return t._id; }));
						});
						return Team.find({_id: {$in: teamIds}}).exec();
					}
					else {
						return q();
							}
				})
				.then((teamResults) => {
					if (null != teamResults) {
						teamTitleMap = _.keyBy(teamResults, '_id');

						// Convert user.groups to human readable groups string
						userData.forEach((user) => {
							let teamNames = user.teams.map((t) => {
								return (_.has(teamTitleMap, t._id) ? teamTitleMap[t._id].name : '<missing>');
							});

							// Formatted team name string, ex. "Group 1, SomeDev, Test Group"
							user.teams = teamNames.join(', ');
						});
					}
					exportConfigController.exportCSV(req, res, fileName, columns, userData);
				});
		}, (error) => {
			utilService.handleErrorResponse(res, error);
		})
		.done();
};
