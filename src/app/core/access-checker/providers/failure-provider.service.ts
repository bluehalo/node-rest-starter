import { AccessCheckerProvider } from '../access-checker.provider';

// Simple example provider that always throws an error
export default class ExampleProvider implements AccessCheckerProvider {
	get(): Promise<Record<string, any>> {
		throw new Error('Stuffs broke.');
	}
}
