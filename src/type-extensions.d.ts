import { ExportConfigDocument } from './app/core/export/export-config.model';
import { FeedbackDocument } from './app/core/feedback/feedback.model';
import { MessageDocument } from './app/core/messages/message.model';
import { TeamDocument } from './app/core/teams/team.model';
import { UserAgreementDocument } from './app/core/user/eua/eua.model';
import { UserDocument } from './app/core/user/user.model';

declare module 'fastify' {
	// @ts-expect-error sets PassportUser type to the IUser
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	interface PassportUser extends UserDocument {}

	interface FastifyRequest {
		team: TeamDocument;
		userParam: UserDocument;
		euaParam: UserAgreementDocument;
		feedback: FeedbackDocument;
		message: MessageDocument;
		exportConfig: ExportConfigDocument;
		exportQuery: unknown;
	}
}
