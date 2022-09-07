'use strict';

const should = require('should'),
	sinon = require('sinon'),
	mongoose = require('mongoose'),
	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	messagesService = require('./messages.service');

const User = dbs.admin.model('User');
const Message = dbs.admin.model('Message');
const DismissedMessage = dbs.admin.model('DismissedMessage');

/**
 * Helpers
 */
const clearDatabase = () => {
	return Promise.all([Message.deleteMany(), DismissedMessage.deleteMany()]);
};

const messageSpec = (key) => {
	return {
		title: `${key} Title`,
		type: 'INFO',
		body: `${key} Message Body`
	};
};

const createMessages = async (count) => {
	const promises = [];

	for (let i = 0; i < count; i++) {
		promises.push(new Message(messageSpec(i)).save());
	}

	await Promise.all(promises);
};

/**
 * Unit tests
 */
describe('Messages Service:', () => {
	let sandbox;

	const user = new User({ _id: new mongoose.Types.ObjectId() });

	beforeEach(async () => {
		sandbox = sinon.createSandbox();
		await clearDatabase();
	});

	beforeEach(async () => {
		sandbox.restore();
		await clearDatabase();
	});

	describe('getRecentMessages', () => {
		it('should retrieve all messages, if none are dismissed', async () => {
			//
			const msgCount = 100;
			await createMessages(msgCount);

			const messages = await messagesService.getRecentMessages(null);

			should.exist(messages);
			messages.should.be.Array();
			messages.length.should.equal(msgCount);
		});

		it('should retrieve non dismissed messages', async () => {
			const msgCount = 20;
			const dismissCount = 5;
			await createMessages(msgCount);

			let messages = await messagesService.getRecentMessages(user._id);

			await messagesService.dismissMessages(
				messages.splice(0, dismissCount).map((m) => m._id.toString()),
				user
			);

			messages = await messagesService.getRecentMessages(user._id);

			should.exist(messages);
			messages.should.be.Array();
			messages.length.should.equal(msgCount - dismissCount);
		});
	});
});
