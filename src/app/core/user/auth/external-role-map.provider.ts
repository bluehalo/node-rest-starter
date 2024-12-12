import { FilterQuery } from 'mongoose';

import { IUser, UserDocument } from '../user.model';

export interface ExternalRoleMapProvider {
	hasRole(user: Partial<IUser>, role: string): boolean;
	generateFilterForRole(role: string): FilterQuery<UserDocument>;
}
