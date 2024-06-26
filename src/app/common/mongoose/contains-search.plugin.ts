import { Query, Schema } from 'mongoose';

import { utilService } from '../../../dependencies';

export interface ContainsSearchable {
	containsSearch(search: string, fields?: string[]): this;
}

export function containsSearchPlugin<
	EnforcedDocType,
	TModelType,
	TInstanceMethods
>(
	schema: Schema<EnforcedDocType, TModelType, TInstanceMethods>,
	pluginOptions: { fields?: string[] } = {}
) {
	schema.query['containsSearch'] = function (
		this: Query<unknown, unknown>,
		search: string,
		fields: string[] = pluginOptions.fields ?? []
	) {
		if (null == search || '' === search) {
			return this;
		}

		if (null == fields || fields.length === 0) {
			return this;
		}

		if (fields.length === 1) {
			return this.where({
				[fields[0]]: {
					$regex: new RegExp(utilService.escapeRegex(search), 'gim')
				}
			});
		}
		return this.where({
			$or: fields.map((element) => ({
				[element]: {
					$regex: new RegExp(utilService.escapeRegex(search), 'gim')
				}
			}))
		});
	};
}
