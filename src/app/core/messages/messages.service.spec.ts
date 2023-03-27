import mongoose from 'mongoose';
import should from 'should';

import { dbs } from '../../../dependencies';
import { UserModel } from '../user/user.model';
import { DismissedMessageModel } from './dismissed-message.model';
import { MessageModel } from './message.model';
import messagesService from './messages.service';

const User: UserModel = dbs.admin.model('User');
const Message: MessageModel = dbs.admin.model('Message');
const DismissedMessage: DismissedMessageModel =
	dbs.admin.model('DismissedMessage');

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
