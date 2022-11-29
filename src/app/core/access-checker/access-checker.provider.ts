export interface AccessCheckerProvider {
	get: (key: string) => Promise<Record<string, unknown>>;
}
