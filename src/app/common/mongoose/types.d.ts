export interface TextSearchPlugin {
	textSearch(search: string);
}

export interface ContainsSearchPlugin {
	containsSearch(search: string, fields?: string[]);
}

export interface PaginatePlugin {
	paginate(
		pageSize: number,
		pageNumber: number,
		runCount: boolean,
		countTimeout: number
	);
}
