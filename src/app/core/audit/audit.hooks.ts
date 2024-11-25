import { DoneFuncWithErrOrRes, FastifyReply, FastifyRequest } from 'fastify';

import { auditService } from '../../../dependencies';

/**
 * Creates before audit copy of event data.
 *
 * Should be called from fastify's `preHandle` hook, after another preHandle hook
 * that loads data and stores on request.  Stores a `before` audit copy for use in
 * {@link audit}
 *
 * @example
 * fastify.route({
 * 		method: 'POST',
 * 		url: '/example/path',
 * 		preHandler: [loadSampleToReqProp, auditTrackBefore('sample')],
 * 		handler: async function(req, reply) {
 * 			const sample = req.sample;
 * 			const respObj = await doSomething(sample);
 * 			return reply.send(respObj);
 * 		},
 * 		preSerialization: audit('audit message', 'audit type', 'audit action')
 * })
 *
 * @param propertyName
 */
export function auditTrackBefore(propertyName: string) {
	return function (
		req: FastifyRequest,
		reply: FastifyReply,
		done: DoneFuncWithErrOrRes
	) {
		const auditObject = req[propertyName];
		if (hasAuditCopy(auditObject)) {
			req['auditBefore'] = auditObject.auditCopy();
		}
		done();
	};
}

/**
 * Logs audit event. Checks `payload` for `auditCopy` for generating `audit.eventObject`.
 *
 * Should be called from fastify's `preSerialization` hook.
 *
 * @example
 * fastify.route({
 * 		method: 'POST',
 * 		url: '/example/path',
 * 		handler: async function(req, reply) {
 * 			const respObj = await doSomething();
 * 			return reply.send(respObj);
 * 		},
 * 		preSerialization: audit('audit message', 'audit type', 'audit action')
 * })
 *
 * @param message
 * @param type
 * @param action
 */
export function audit({
	message,
	type,
	action
}: {
	message: string;
	type: string;
	action: string;
}) {
	return async function (
		req: FastifyRequest,
		reply: FastifyReply,
		payload: unknown
	) {
		let eventObject: unknown = {};
		if (hasAuditCopy(payload)) {
			eventObject = payload.auditCopy();
		}

		const before = req['auditBefore'];
		if (before) {
			eventObject = {
				before,
				after: eventObject
			};
		}

		await auditService.audit(message, type, action, req, eventObject);
	};
}

interface IHasAuditCopy {
	auditCopy(): Record<string, unknown>;
}

function hasAuditCopy(obj: unknown): obj is IHasAuditCopy {
	return (
		(obj as IHasAuditCopy)?.auditCopy !== undefined &&
		typeof (obj as IHasAuditCopy).auditCopy === 'function'
	);
}
