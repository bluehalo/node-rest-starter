'use strict';

const deps = require('../../../dependencies'),
	config = deps.config,
	dbs = deps.dbs,
	logger = deps.logger,
	auditLogger = deps.auditLogger;

const getMasqueradingUserDn = (eventActor, headers) => {
	if (config.auth.strategy === 'proxy-pki' && config.auth.masquerade) {
		const masqueradeUserDn =
			headers?.[config.masqueradeUserHeader ?? 'x-masquerade-user-dn'];
		if (eventActor.dn && eventActor.dn === masqueradeUserDn) {
			return headers?.[config.proxyPkiPrimaryUserHeader ?? 'x-ssl-client-s-dn'];
		}
	}
	return undefined;
};

/**
 * Creates an audit entry persisted to Mongo and the bunyan logger
 *
 * @param {string} message
 * @param {string} eventType
 * @param {string} eventAction
 * @param {* | Promise<*>} eventActor
 * @param {*} eventObject
 * @param {*} [eventMetadata]
 * @param {boolean} [stringifyEventObject]
 * @returns {Promise<import('./types').AuditDocument>}
 */
module.exports.audit = async (
	message,
	eventType,
	eventAction,
	eventActor,
	eventObject,
	eventMetadata = null,
	stringifyEventObject = false
) => {
	/**
	 * @type {import('./types').AuditModel}
	 */
	const Audit = dbs.admin.model('Audit');
	const utilService = deps.utilService;

	const actor = await Promise.resolve(eventActor);

	// Extract additional metadata to audit
	const userAgentObj = utilService.getUserAgentFromHeader(eventMetadata);

	// Send to Mongo
	const newAudit = new Audit({
		created: Date.now(),
		message: message,
		audit: {
			auditType: eventType,
			action: eventAction,
			actor: actor,
			userSpec: userAgentObj
		}
	});

	const masqueradingUserDn = getMasqueradingUserDn(actor, eventMetadata);
	if (masqueradingUserDn) {
		newAudit.audit.masqueradingUser = masqueradingUserDn;
	}

	newAudit.audit.object = stringifyEventObject
		? JSON.stringify(eventObject)
		: eventObject;

	// Send to bunyan logger for logfile persistence
	auditLogger.audit(
		message,
		eventType,
		eventAction,
		actor,
		eventObject,
		userAgentObj
	);

	return newAudit.save().catch((err) => {
		// Log and continue the error
		logger.error(
			{ err: err, audit: newAudit },
			'Error trying to persist audit record to storage.'
		);
		return Promise.reject(err);
	});
};
