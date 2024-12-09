import { Type } from '@fastify/type-provider-typebox';

import { FeedbackType } from './feedback.model';

export const FeedbackSetAssigneeType = Type.Pick(FeedbackType, ['assignee']);

export const FeedbackSetStatusType = Type.Pick(FeedbackType, ['status']);

export const CreateFeedbackType = Type.Pick(FeedbackType, [
	'body',
	'type',
	'url',
	'classification'
]);
