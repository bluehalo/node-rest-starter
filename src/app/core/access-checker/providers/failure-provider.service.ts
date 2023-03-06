import { AccessCheckerProvider } from '../access-checker.provider';

// Simple example provider that always throws an error
export default class ExampleProvider implements AccessCheckerProvider {
	get(): Promise<Record<string, unknown>> {
		throw new Error('Stuffs broke.');
	}
}
