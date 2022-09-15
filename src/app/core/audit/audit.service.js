'use strict';

const {
	dbs,
	config,
	logger,
	auditLogger,
	utilService
} = require('../../../dependencies');

// Creates an audit entry persisted to Mongo and the bunyan logger

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
 * @param {import('express').Request | Promise<object> | object} requestOrEventActor
 * @param {object} eventObject
 * @param {*} eventMetadata
 * @returns {Promise<any>}
 */
module.exports.audit = async (
	message,
	eventType,
	eventAction,
	requestOrEventActor,
	eventObject,
	eventMetadata = null
) => {
	/**
	 * @type {import('./types').AuditModel}
	 */
	const Audit = dbs.admin.model('Audit');

	requestOrEventActor = await requestOrEventActor;

	let actor = {};
	if (requestOrEventActor.name && requestOrEventActor.username) {
		actor = requestOrEventActor;
	} else if (requestOrEventActor.user && requestOrEventActor.headers) {
		const TeamMember = dbs.admin.model('TeamUser');
		actor = await TeamMember.auditCopy(
			requestOrEventActor.user,
			utilService.getHeaderField(requestOrEventActor.headers, 'x-real-ip')
		);
		eventMetadata = requestOrEventActor.headers;
	}

	// Extract additional metadata to audit
	const userAgentObj = utilService.getUserAgentFromHeader(eventMetadata);

	// Send to Mongo
	const newAudit = new Audit({
		message: message,
		audit: {
			auditType: eventType,
			action: eventAction,
			object: eventObject,
			actor,
			userSpec: userAgentObj
		}
	});

	const masqueradingUserDn = getMasqueradingUserDn(actor, eventMetadata);
	if (masqueradingUserDn) {
		newAudit.audit.masqueradingUser = masqueradingUserDn;
	}

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
