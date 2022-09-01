import { Document, Model } from 'mongoose';

interface IAudit extends Document {
	created: Date;
	message: string;
	audit: {
		auditType: string;
		action: string;
		actor: Object;
		object: string | Object;
		userSpec: {
			browser: string;
			os: string;
		};
		masqueradingUser?: string;
	};
}

export type AuditDocument = IAudit;

export type AuditModel = Model<AuditDocument>;
