'use strict';

const
	kafkaProducer = require('../../../lib/kafka-producer');

exports.publish = function(destination, message, retry, key) {
	if (key) {
		return kafkaProducer.sendMessageForTopicWithKey(destination, JSON.stringify(message), key, false);
	}

	return kafkaProducer.sendMessageForTopic(destination, JSON.stringify(message), retry);
};
