import { getEventEmitter } from './event-emitter.service';

export function publish(destination, message) {
	getEventEmitter().emit(destination, message);
}
