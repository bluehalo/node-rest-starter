import { FilterQuery } from 'mongoose';

import {
	Notification,
	NotificationDocument,
	NotificationModel
} from './notification.model';
import { utilService } from '../../../dependencies';
import { PagingResults } from '../../common/mongoose/paginate.plugin';

class NotificationService {
	constructor(private model: NotificationModel) {}

	search(
		queryParams = {},
		query: FilterQuery<NotificationDocument> = {}
	): Promise<PagingResults<NotificationDocument>> {
		const page = utilService.getPage(queryParams);
		const limit = utilService.getLimit(queryParams, 100);
		const sort = utilService.getSortObj(queryParams);

		// Query for feedback
		return this.model.find(query).sort(sort).paginate(limit, page);
	}
}

export = new NotificationService(Notification);
