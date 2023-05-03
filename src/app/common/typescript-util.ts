export type Override<T, K extends keyof T, TReplace> = Omit<T, K> & {
	[P in K]: TReplace;
};

export type IdOrObject<ID_TYPE> = ID_TYPE | { _id: ID_TYPE };
