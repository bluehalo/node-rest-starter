import assert from 'node:assert/strict';

import mongoose from 'mongoose';

import { DismissedMessage } from './dismissed-message.model';
import { Message } from './message.model';
import messagesService from './messages.service';
import { User } from '../user/user.model';

/**
 * Helpers
 */
const clearDatabase = () => {
	return Promise.all([Message.deleteMany(), DismissedMessage.deleteMany()]);
};

const messageSpec = (key: string | number) => {
	return {
		title: `${key} Title`,
		type: 'INFO',
		body: `${key} Message Body`
	};
};

const createMessages = async (count: number) => {
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
	const user = new User({ _id: new mongoose.Types.ObjectId() });

	beforeEach(async () => {
		await clearDatabase();
	});

	beforeEach(async () => {
		await clearDatabase();
	});

	describe('getRecentMessages', () => {
		it('should retrieve all messages, if none are dismissed', async () => {
			//
			const msgCount = 100;
			await createMessages(msgCount);

			const messages = await messagesService.getRecentMessages(null);

			assert.ok(Array.isArray(messages), 'messages should be an Array');
			assert.equal(messages.length, msgCount);
		});

		it('should retrieve non dismissed messages', async () => {
			const msgCount = 20;
			const dismissCount = 5;
			await createMessages(msgCount);

			let messages = await messagesService.getRecentMessages(user._id);

			await messagesService.dismissMessages(
				messages.splice(0, dismissCount).map((m) => m._id),
				user
			);

			messages = await messagesService.getRecentMessages(user._id);

			assert.ok(Array.isArray(messages), 'messages should be an Array');
			assert.equal(messages.length, msgCount - dismissCount);
		});
	});
});
