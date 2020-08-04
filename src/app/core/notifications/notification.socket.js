'use strict';

const
	_ = require('lodash'),
	nodeUtil = require('util'),
	path = require('path'),

	deps = require('../../../dependencies'),
	config = deps.config,
	logger = deps.logger,
	socketIO = deps.socketIO,

	socketProvider = require(path.posix.resolve(config.socketProvider)),
	users = require('../user/user.controller'),

	emitName = 'alert';

/**
 * NotificationSocket Socket Controller that overrides Base Socket Controller
 * methods to handle specifics of Notifications
 */
function NotificationSocket(...args) {
	this._emitType = `${emitName}:data`;
	this._topicName = config.dispatcher ? config.dispatcher.notificationTopic : '';
	this._subscriptionCount = 0;
	socketProvider.apply(this, args);
}

nodeUtil.inherits(NotificationSocket, socketProvider);

NotificationSocket.prototype.name = 'NotificationSocket';

/**
 * @override
 *
 */
NotificationSocket.prototype.getEmitNotificationKey = () => {
	return '';
};

NotificationSocket.prototype.getEmitMessage = function(json, rawMessage, consumer) {
	return {
		value: json,
		key: this.getEmitMessageKey(json, rawMessage, consumer)
	};
};
//
NotificationSocket.prototype.ignorePayload = function(json) {
	// Ignore any payloads that do not match the current user.
	return !json || !json.user || json.user.toString() !== this.getUserId().toString();
};

/**
 * Returns the topic for a user ID.
 */
NotificationSocket.prototype.getTopic = function(userId) {
	return this._topicName;
};

/**
 * Handle socket disconnects
 */
NotificationSocket.prototype.disconnect = function() {
	logger.info('NotificationSocket: Disconnected from client.');

	this.unsubscribe(this.getTopic());

};

/**
 * Handle socket errors
 */
NotificationSocket.prototype.error = function(err) {
	logger.error(err, 'NotificationSocket: Client connection error');

	this.unsubscribe(this.getTopic());
};

/**
 *
 */
NotificationSocket.prototype.handleSubscribe = function(payload) {
	const self = this;

	if(logger.debug()) {
		logger.debug(`NotificationSocket: ${emitName}:subscribe event with payload: ${JSON.stringify(payload)}`);
	}

	// Check that the user account has access
	self.applyMiddleware([
		users.hasAccess
	]).then(() => {
		// Subscribe to the user's notification topic
		const topic = self.getTopic();
		self.subscribe(topic);
		self._subscriptionCount++;
	}).catch((err) => {
		logger.warn(`Unauthorized access to notifications by inactive user ${self.getUserId()}: ${err}`);
	});
};

/**
 *
 */
NotificationSocket.prototype.handleUnsubscribe = function(payload) {
	if(logger.debug()) {
		logger.debug(`NotificationSocket: ${emitName}:unsubscribe event with payload: ${JSON.stringify(payload)}`);
	}

	const topic = this.getTopic();
	this.unsubscribe(topic);

	this._subscriptionCount = Math.max(0, this._subscriptionCount - 1);
	// If we are no longer listening for anything, unsubscribe
	if (this._subscriptionCount === 0) {
		this.unsubscribe(this.getTopic());
	}
};

/**
 *
 */
NotificationSocket.prototype.addListeners = function() {
	const s = this.getSocket();

	if(typeof s.on === 'function') {
		// Set up Subscribe events
		s.on(`${emitName}:subscribe`, this.handleSubscribe.bind(this));

		// Set up Unsubscribe events
		s.on(`${emitName}:unsubscribe`, this.handleUnsubscribe.bind(this));
	}
};

if (config.dispatcher && (!_.has(config.dispatcher, 'enabled') || config.dispatcher.enabled)) {
	socketIO.registerSocketListener(NotificationSocket);
}

module.exports = NotificationSocket;
