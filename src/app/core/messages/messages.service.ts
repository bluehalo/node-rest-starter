import path from 'node:path';

import { FilterQuery, PopulateOptions, Types } from 'mongoose';

import {
	DismissedMessage,
	DismissedMessageDocument,
	DismissedMessageModel,
	IDismissedMessage
} from './dismissed-message.model';
import {
	IMessage,
	Message,
	MessageDocument,
	MessageModel
} from './message.model';
import { config, utilService } from '../../../dependencies';
import { PublishProvider } from '../../common/event/publish.provider';
import { PagingResults } from '../../common/mongoose/paginate.plugin';
import { UserDocument } from '../user/user.model';

class MessagesService {
	publishProvider: PublishProvider;

	constructor(
		private model: MessageModel,
		private dismissedModel: DismissedMessageModel
	) {}

	create(user: UserDocument, doc: Partial<IMessage>): Promise<MessageDocument> {
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

	update(
		document: MessageDocument,
		obj: Partial<IMessage>
	): Promise<MessageDocument> {
		document.set(obj);
		return document.save();
	}

	async delete(document: MessageDocument): Promise<MessageDocument> {
		await document.deleteOne();
		return document;
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
		const timeLimit =
			config.get<number>('messages.dismissedTimeSeconds') * 1000;

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

		return allMessages.filter((message) => {
			const isDismissed = dismissedMessages.some((dismissed) =>
				dismissed.messageId.equals(message._id)
			);
			return !isDismissed;
		});
	}

	dismissMessages(
		messageIds: Types.ObjectId[],
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
			config.get('messages.topic'),
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
				path.posix.resolve(config.get('publishProvider'))
			);
		}
		return this.publishProvider;
	}
}

export = new MessagesService(Message, DismissedMessage);
