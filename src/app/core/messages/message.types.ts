import { Type } from '@fastify/type-provider-typebox';

import { MessageType } from './message.model';

export const DismissMessagesType = Type.Object({
	messageIds: Type.Array(MessageType.properties._id)
});

export const CreateMessageType = Type.Pick(MessageType, [
	'type',
	'title',
	'body'
]);
