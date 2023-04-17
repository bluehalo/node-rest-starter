export type PublishProvider = {
	publish: (destination: string, message: unknown, retry?: boolean) => void;
};
