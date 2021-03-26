'use strict';

const eventEmitter = require('./event-emitter.service');

exports.publish = function (destination, message, retry) {
	eventEmitter.getEventEmitter().emit(destination, message);
};
