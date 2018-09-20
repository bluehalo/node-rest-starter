'use strict';

const
	q = require('q'),

	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	logger = deps.logger,
	auditLogger = deps.auditLogger;

// Creates an audit entry persisted to Mongo and the bunyan logger
module.exports.audit = function(message, eventType, eventAction, eventActor, eventObject, eventMetadata, stringifyEventObject) {
	let Audit = dbs.admin.model('Audit');
	let utilService = deps.utilService;

	return q.resolve(eventActor).then((actor) => {
		// Extract additional metadata to audit
		let userAgentObj = utilService.getUserAgentFromHeader(eventMetadata);

		// Send to Mongo
		let newAudit = new Audit({
			created: Date.now(),
			message: message,
			audit: {
				auditType: eventType,
				action: eventAction,
				actor: actor,
				userSpec: userAgentObj
			}
		});

		newAudit.audit.object = stringifyEventObject ? JSON.stringify(eventObject) : eventObject;

		// Send to bunyan logger for logfile persistence
		auditLogger.audit(message, eventType, eventAction, actor, eventObject, userAgentObj);

		return newAudit
			.save()
			.then(
				(result) => {
					return q(result);
				},
				(err) => {
					// Log and continue the error
					logger.error({err: err, audit: newAudit}, 'Error trying to persist audit record to storage.');
					return q.reject(err);
				});
	});
};
