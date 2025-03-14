import { FilterQuery, PopulateOptions, Types } from 'mongoose';

import {
	IUserAgreement,
	UserAgreementDocument,
	UserAgreementModel,
	UserAgreement
} from './eua.model';
import { utilService } from '../../../../dependencies';
import { PagingResults } from '../../../common/mongoose/paginate.plugin';
import { UserDocument } from '../user.model';

class EuaService {
	constructor(private model: UserAgreementModel) {}

	create(doc: unknown): Promise<UserAgreementDocument> {
		const document = new this.model(doc);
		return document.save();
	}

	read(
		id: string | Types.ObjectId,
		populate:
			| string
			| string[]
			| PopulateOptions
			| Array<string | PopulateOptions> = []
	): Promise<UserAgreementDocument | null> {
		return this.model
			.findById(id)
			.populate(populate as string[])
			.exec();
	}

	update(
		document: UserAgreementDocument,
		obj: Partial<IUserAgreement>
	): Promise<UserAgreementDocument> {
		// Copy over the new eua properties
		document.text = obj.text;
		document.title = obj.title;

		return document.save();
	}

	async delete(
		document: UserAgreementDocument
	): Promise<UserAgreementDocument> {
		await document.deleteOne();
		return document;
	}

	search(
		queryParams = {},
		search = '',
		query: FilterQuery<UserAgreementDocument> = {}
	): Promise<PagingResults<UserAgreementDocument>> {
		query = query ?? {};
		const page = utilService.getPage(queryParams);
		const limit = utilService.getLimit(queryParams);
		const sort = utilService.getSortObj(queryParams, 'DESC', 'title');

		return this.model
			.find(query)
			.textSearch(search)
			.sort(sort)
			.paginate(limit, page);
	}

	/**
	 * @param document The eua to publish
	 */
	publishEua(document: UserAgreementDocument): Promise<UserAgreementDocument> {
		document.published = new Date();
		return document.save();
	}

	getCurrentEua(): Promise<UserAgreementDocument | null> {
		return this.model
			.findOne({ published: { $ne: null, $exists: true } })
			.sort({ published: -1 })
			.exec();
	}

	acceptEua(user: UserDocument): Promise<UserDocument> {
		user.acceptedEua = new Date();
		return user.save();
	}
}

export = new EuaService(UserAgreement);
