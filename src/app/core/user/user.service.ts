import { Readable } from 'stream';

import { FilterQuery, PopulateOptions, Types } from 'mongoose';

import { UserDocument, UserModel, User } from './user.model';
import { utilService } from '../../../dependencies';
import { PagingResults } from '../../common/mongoose/paginate.plugin';

class UserService {
	constructor(private model: UserModel) {}

	read(
		id: string | Types.ObjectId,
		populate:
			| string
			| string[]
			| PopulateOptions
			| Array<string | PopulateOptions> = []
	): Promise<UserDocument> {
		return this.model
			.findById(id)
			.populate(populate as string[])
			.exec();
	}

	update(document: UserDocument, obj = {}): Promise<UserDocument> {
		document.set(obj);
		return document.save();
	}

	async remove(document: UserDocument): Promise<UserDocument> {
		await document.deleteOne();
		return document;
	}

	searchUsers(
		queryParams = {},
		query: FilterQuery<UserDocument> = {},
		search = '',
		searchFields: string[] = [],
		populate:
			| string
			| string[]
			| PopulateOptions
			| Array<string | PopulateOptions> = []
	): Promise<PagingResults<UserDocument>> {
		query = query || {};
		const page = utilService.getPage(queryParams);
		const limit = utilService.getLimit(queryParams);
		const sort = utilService.getSortObj(queryParams, 'DESC', '_id');

		let mQuery = this.model.find(query);

		if (searchFields.length > 0) {
			mQuery = mQuery.containsSearch(search, searchFields);
		} else {
			mQuery = mQuery.textSearch(search);
		}

		return mQuery
			.sort(sort)
			.populate(populate as string[])
			.paginate(limit, page);
	}

	cursorSearch(
		queryParams = {},
		search = '',
		query: FilterQuery<UserDocument> = {},
		searchFields: string[] = [],
		populate:
			| string
			| string[]
			| PopulateOptions
			| Array<string | PopulateOptions> = []
	): Readable {
		const sort = utilService.getSortObj(queryParams, 'DESC', '_id');

		let mQuery = this.model.find(query);

		if (searchFields.length > 0) {
			mQuery = mQuery.containsSearch(search, searchFields);
		} else {
			mQuery = mQuery.textSearch(search);
		}

		return mQuery
			.sort(sort)
			.populate(populate as string[])
			.cursor();
	}

	updateLastLogin(document: UserDocument): Promise<UserDocument> {
		document.lastLogin = new Date();
		return document.save();
	}

	updateLastLoginWithAccess(document: UserDocument): Promise<UserDocument> {
		document.lastLoginWithAccess = new Date();
		return document.save();
	}

	updatePreferences(
		user: UserDocument,
		pref: Record<string, unknown>
	): Promise<UserDocument> {
		user.preferences = { ...user.preferences, ...pref };
		return user.save();
	}

	updateRequiredOrgs(
		user: UserDocument,
		requiredOrgs: Record<string, unknown>
	): Promise<UserDocument> {
		user.organizationLevels = requiredOrgs;
		return user.save();
	}
}

export = new UserService(User);
