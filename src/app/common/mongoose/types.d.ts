import { Document } from 'mongoose';

export interface PagingResults<DocType extends Document = Document> {
	pageNumber: number;
	pageSize: number;
	totalPages: number;
	totalSize: number;
	elements: DocType[];
}

export interface TextSearchPlugin {
	textSearch(search: string): this;
}

export interface ContainsSearchPlugin {
	containsSearch(search: string, fields?: string[]): this;
}

export interface PaginatePlugin<DocType extends Document> {
	paginate(
		pageSize: number,
		pageNumber: number,
		runCount?: boolean,
		countTimeout?: number
	): Promise<PagingResults<DocType>>;
}
