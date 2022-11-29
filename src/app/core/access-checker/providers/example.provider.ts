import { AccessCheckerProvider } from '../access-checker.provider';

// Simple example provider that simply returns the user if they exist in the config
export default class ExampleProvider implements AccessCheckerProvider {
	constructor(private config) {}

	get(id: string): Promise<Record<string, unknown>> {
		return Promise.resolve(this.config[id]);
	}
}
