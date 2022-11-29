import { FilterQuery } from 'mongoose';

import { dbs, utilService } from '../../../dependencies';
import { PagingResults } from '../../common/mongoose/paginate.plugin';
import { NotificationDocument, NotificationModel } from './notification.model';

class NotificationService {
	model: NotificationModel;

	constructor() {
		this.model = dbs.admin.model('Notification');
	}

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

export = new NotificationService();
