import { getEventEmitter } from './event-emitter.service';

export function publish(destination: string, message: unknown) {
	getEventEmitter().emit(destination, message);
}
