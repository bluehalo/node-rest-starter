import path from 'path';

import { FilterQuery, PopulateOptions, Types } from 'mongoose';

import { dbs, config, utilService } from '../../../dependencies';
import { PagingResults } from '../../common/mongoose/paginate.plugin';
import { UserDocument } from '../user/user.model';
import {
	DismissedMessageDocument,
	DismissedMessageModel,
	IDismissedMessage
} from './dismissed-message.model';
import { IMessage, MessageDocument, MessageModel } from './message.model';

type PublishProvider = {
	publish: (destination: string, message: unknown, retry: boolean) => void;
};

class MessagesService {
	model: MessageModel;
	dismissedModel: DismissedMessageModel;
	publishProvider: PublishProvider;

	constructor() {
		this.model = dbs.admin.model('Message');
		this.dismissedModel = dbs.admin.model('DismissedMessage');
	}

	create(user: UserDocument, doc: unknown): Promise<MessageDocument> {
		const message = new this.model(doc);
		message.creator = user._id;

		return message.save();
	}

	read(
		id: string | Types.ObjectId,
		populate:
			| string
			| string[]
			| PopulateOptions
			| Array<string | PopulateOptions> = []
	): Promise<MessageDocument | null> {
		return this.model
			.findById(id)
			.populate(populate as string[])
			.exec();
	}

	update(document: MessageDocument, obj: unknown): Promise<MessageDocument> {
		document.set(obj);
		return document.save();
	}

	delete(document: MessageDocument): Promise<MessageDocument> {
		return document.remove();
	}

	search(
		queryParams = {},
		search = '',
		query: FilterQuery<MessageDocument> = {}
	): Promise<PagingResults<MessageDocument>> {
		query = query || {};
		const page = utilService.getPage(queryParams);
		const limit = utilService.getLimit(queryParams);
		const sort = utilService.getSortObj(queryParams, 'DESC', 'updated');

		return this.model
			.find(query)
			.textSearch(search)
			.sort(sort)
			.paginate(limit, page);
	}

	getAllMessages(): Promise<Array<IMessage>> {
		const timeLimit = config['dismissedMessagesTimePeriod'] ?? 604800000;

		return this.model
			.find()
			.where('created')
			.gte(Date.now() - timeLimit)
			.lean()
			.exec();
	}

	getDismissedMessages(
		userId: string | Types.ObjectId
	): Promise<Array<IDismissedMessage>> {
		return this.dismissedModel.find({ userId: userId }).lean().exec();
	}

	/**
	 * Get recent, unread messages
	 */
	async getRecentMessages(
		userId: string | Types.ObjectId
	): Promise<Array<IMessage>> {
		const [allMessages, dismissedMessages] = await Promise.all([
			this.getAllMessages(),
			this.getDismissedMessages(userId)
		]);

		const filteredMessages = allMessages.filter((message) => {
			const isDismissed = dismissedMessages.some((dismissed) =>
				dismissed.messageId.equals(message._id)
			);
			return !isDismissed;
		});

		return filteredMessages;
	}

	dismissMessages(
		messageIds: string[],
		user: UserDocument
	): Promise<Array<DismissedMessageDocument>> {
		const dismissals = messageIds.map((messageId) =>
			new this.dismissedModel({ messageId, userId: user._id }).save()
		);
		return Promise.all(dismissals);
	}

	async publishMessage(message: MessageDocument): Promise<void> {
		const provider = await this.getProvider();
		provider.publish(
			config.messages.topic,
			{
				type: 'message',
				id: message._id.toString(),
				time: Date.now(),
				message: message.toObject()
			},
			true
		);
	}

	async getProvider(): Promise<PublishProvider> {
		if (!this.publishProvider) {
			this.publishProvider = await import(
				path.posix.resolve(config.publishProvider)
			);
		}
		return this.publishProvider;
	}
}

export = new MessagesService();
