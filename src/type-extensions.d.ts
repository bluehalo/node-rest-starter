import { ExportConfigDocument } from './app/core/export/export-config.model';
import { TeamDocument } from './app/core/teams/team.model';
import { UserAgreementDocument } from './app/core/user/eua/eua.model';
import { UserDocument } from './app/core/user/user.model';

declare module 'fastify' {
	// @ts-expect-error sets PassportUser type to the IUser
	// eslint-disable-next-line @typescript-eslint/no-empty-interface
	interface PassportUser extends UserDocument {}

	interface FastifyRequest {
		team: TeamDocument;
		userParam: UserDocument;
		euaParam: UserAgreementDocument;
		exportConfig: ExportConfigDocument;
		exportQuery: unknown;
	}
}
