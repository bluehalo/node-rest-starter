import config from 'config';
import { Request } from 'express';
import { FastifyRequest } from 'fastify';

import { Audit, AuditDocument } from './audit.model';
import { utilService } from '../../../dependencies';
import { logger, auditLogger } from '../../../lib/logger';
import { IUser, UserDocument } from '../user/user.model';

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
		requestOrEventActor:
			| Request
			| FastifyRequest
			| Promise<Partial<IUser>>
			| Partial<IUser>,
		eventObject: unknown,
		eventMetadata = null
	): Promise<AuditDocument> {
		requestOrEventActor = await requestOrEventActor;

		let actor = {};
		if (this.isUser(requestOrEventActor)) {
			actor = requestOrEventActor;
		} else if (requestOrEventActor.user && requestOrEventActor.headers) {
			const user = requestOrEventActor.user as UserDocument;
			actor = user.auditCopy(
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

		// Send to audit logger for logfile persistence
		auditLogger.info(message, {
			audit: {
				type: eventType,
				action: eventAction,
				actor: actor,
				object: eventObject,
				userAgent: userAgentObj
			}
		});

		return newAudit.save().catch((err) => {
			// Log and continue the error
			logger.error('Error trying to persist audit record to storage.', {
				err: err,
				audit: newAudit
			});
			return Promise.reject(err);
		});
	}

	/**
	 * Creates an audit entry persisted to Mongo and the bunyan logger
	 */
	private getMasqueradingUserDn(eventActor, headers) {
		if (
			config.get<string>('auth.strategy') === 'proxy-pki' &&
			config.get<boolean>('auth.masquerade')
		) {
			const masqueradeUserDn =
				headers?.[config.get<string>('masqueradeUserHeader')];
			if (eventActor.dn && eventActor.dn === masqueradeUserDn) {
				return headers?.[config.get<string>('proxyPkiPrimaryUserHeader')];
			}
		}
		return undefined;
	}
}

export = new AuditService();
