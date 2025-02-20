import config from 'config';
import { HydratedDocument, Query, Schema } from 'mongoose';

const MONGO_TIMEOUT_ERROR_CODE = 50;

export interface PagingResults<DocType> {
	pageNumber: number;
	pageSize: number;
	totalPages: number;
	totalSize: number;
	elements: DocType[];
}

export interface Paginateable<DocType> {
	paginate(
		pageSize: number,
		pageNumber: number,
		runCount?: boolean,
		countTimeout?: number
	): Promise<PagingResults<DocType>>;
}

export function paginatePlugin<
	EnforcedDocType,
	TModelType,
	TInstanceMethods,
	TQueryHelpers extends Paginateable<EnforcedDocType>
>(
	schema: Schema<EnforcedDocType, TModelType, TInstanceMethods, TQueryHelpers>
) {
	schema.query.paginate = async function <EnforcedDocType>(
		this: Query<
			HydratedDocument<EnforcedDocType>[],
			EnforcedDocType,
			TQueryHelpers
		>,
		pageSize: number,
		pageNumber: number,
		runCount = true,
		countTimeout = config.get<number>('maxCountTimeMS')
	): Promise<PagingResults<EnforcedDocType>> {
		const countPromise = runCount
			? this.model
					.find(this.getFilter())
					.maxTimeMS(countTimeout)
					.countDocuments()
					.exec()
					.catch((error) => {
						// Hit timeout
						if (error.code === MONGO_TIMEOUT_ERROR_CODE) {
							return Promise.resolve(Number.MAX_SAFE_INTEGER);
						}
						return error;
					})
			: Promise.resolve(Number.MAX_SAFE_INTEGER);

		const resultsPromise = this.skip(pageNumber * pageSize)
			.limit(pageSize)
			.maxTimeMS(config.get<number>('maxTimeMS'))
			.exec();

		const [totalSize, elements] = await Promise.all([
			countPromise,
			resultsPromise
		]);
		if (totalSize === 0) {
			pageNumber = 0;
		}
		return {
			pageSize,
			pageNumber,
			totalSize,
			totalPages: Math.ceil(totalSize / pageSize),
			elements
		};
	};
}
