import { HydratedDocument } from 'mongoose';

export interface PagingResults<DocType> {
	pageNumber: number;
	pageSize: number;
	totalPages: number;
	totalSize: number;
	elements: HydratedDocument<DocType>[];
}

export interface TextSearchPlugin {
	textSearch(search: string, sortByTextScore?: boolean): this;
}

export interface ContainsSearchPlugin {
	containsSearch(search: string, fields?: string[]): this;
}

export interface PaginatePlugin<DocType> {
	paginate(
		pageSize: number,
		pageNumber: number,
		runCount?: boolean,
		countTimeout?: number
	): Promise<PagingResults<DocType>>;
}
