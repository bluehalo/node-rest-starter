import { FilterQuery } from 'mongoose';

import { ExternalRoleMapProvider } from './external-role-map.provider';
import { IUser, UserDocument } from '../user.model';

export default class DefaultExternalRoleMapProvider
	implements ExternalRoleMapProvider
{
	constructor(private config: { externalRoleMap: Record<string, string> }) {}

	hasRole(user: Partial<IUser>, role: string): boolean {
		const externalRoles = user.externalRoles || [];
		return externalRoles.indexOf(this.config.externalRoleMap[role]) !== -1;
	}

	generateFilterForRole(role: string): FilterQuery<UserDocument> {
		return { externalRoles: this.config.externalRoleMap[role] };
	}
}
