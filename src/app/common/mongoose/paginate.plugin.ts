import { HydratedDocument, Query, Schema } from 'mongoose';

import { config } from '../../../dependencies';

const MONGO_TIMEOUT_ERROR_CODE = 50;

export interface PagingResults<DocType> {
	pageNumber: number;
	pageSize: number;
	totalPages: number;
	totalSize: number;
	elements: HydratedDocument<DocType>[];
}

export interface Paginateable<DocType> {
	paginate(
		pageSize: number,
		pageNumber: number,
		runCount?: boolean,
		countTimeout?: number
	): Promise<PagingResults<DocType>>;
}

export function paginatePlugin(schema: Schema) {
	schema.query['paginate'] = async function <DocType>(
		this: Query<HydratedDocument<DocType>[], DocType>,
		pageSize: number,
		pageNumber: number,
		runCount = true,
		countTimeout = config.maxCountTimeMS
	): Promise<PagingResults<DocType>> {
		const countPromise = runCount
			? this.model
					.find(this.getFilter())
					.maxTimeMS(countTimeout)
					.countDocuments()
					.exec()
					.catch((err) => {
						// Hit timeout
						if (err.code === MONGO_TIMEOUT_ERROR_CODE) {
							return Promise.resolve(Number.MAX_SAFE_INTEGER);
						}
						return err;
					})
			: Promise.resolve(Number.MAX_SAFE_INTEGER);

		const resultsPromise = this.skip(pageNumber * pageSize)
			.limit(pageSize)
			.maxTimeMS(config.maxTimeMS)
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
