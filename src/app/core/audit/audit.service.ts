import { Request } from 'express';

import {
	dbs,
	config,
	logger,
	auditLogger,
	utilService
} from '../../../dependencies';
import { IUser, UserDocument } from '../user/user.model';
import { AuditDocument, AuditModel } from './audit.model';

class AuditService {
	isUser = (obj: unknown): obj is Partial<IUser> => {
		return typeof obj === 'object' && 'name' in obj && 'username' in obj;
	};

	/**
	 * Creates an audit entry persisted to Mongo and the bunyan logger
	 *
	 * @param message Audit message
	 * @param eventType Audit Event Type
	 * @param eventAction Audit Action
	 * @param requestOrEventActor Request or Event Actor Information
	 * @param eventObject Audit Event Object
	 * @param eventMetadata Audit Event Metadata
	 * @returns Promise of the saved Audit Document
	 */
	async audit(
		message: string,
		eventType: string,
		eventAction: string,
		requestOrEventActor: Request | Promise<Partial<IUser>> | Partial<IUser>,
		eventObject: unknown,
		eventMetadata = null
	): Promise<AuditDocument> {
		// Delay resolving the Audit model until we can be sure it has been initialized
		const Audit = dbs.admin.model('Audit') as AuditModel;

		requestOrEventActor = await requestOrEventActor;

		let actor = {};
		if (this.isUser(requestOrEventActor)) {
			actor = requestOrEventActor;
		} else if (requestOrEventActor.user && requestOrEventActor.headers) {
			const user = requestOrEventActor.user as UserDocument;
			actor = await user.auditCopy(
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

		const masqueradingUserDn = this.getMasqueradingUserDn(actor, eventMetadata);
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
	}

	/**
	 * Creates an audit entry persisted to Mongo and the bunyan logger
	 */
	private getMasqueradingUserDn(eventActor, headers) {
		if (config.auth.strategy === 'proxy-pki' && config.auth.masquerade) {
			const masqueradeUserDn =
				headers?.[config.masqueradeUserHeader ?? 'x-masquerade-user-dn'];
			if (eventActor.dn && eventActor.dn === masqueradeUserDn) {
				return headers?.[
					config.proxyPkiPrimaryUserHeader ?? 'x-ssl-client-s-dn'
				];
			}
		}
		return undefined;
	}
}

export = new AuditService();
