import { HydratedDocument, Model } from 'mongoose';

interface IAudit {
	created: Date;
	message: string;
	audit: {
		auditType: string;
		action: string;
		actor: Record<string, unknown>;
		object: string | Record<string, unknown>;
		userSpec: {
			browser: string;
			os: string;
		};
		masqueradingUser?: string;
	};
}

export type AuditDocument = HydratedDocument<IAudit>;

export type AuditModel = Model<AuditDocument>;
