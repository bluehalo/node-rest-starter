import { FilterQuery } from 'mongoose';

import { IUser, UserDocument } from '../user.model';

export interface ExternalRoleMapProvider {
	hasRole(user: Partial<IUser>, role): boolean;
	generateFilterForRole(role): FilterQuery<UserDocument>;
}
