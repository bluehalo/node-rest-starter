import _ from 'lodash';
import { DateTime } from 'luxon';

export const Callbacks = {
	trueFalse: (value: unknown) => (value ? 'true' : 'false'),
	isoDateString: (value: unknown) => {
		if (_.isString(value) || _.isNumber(value) || _.isDate(value)) {
			return DateTime.fromJSDate(new Date(value)).toISO();
		}
		return '';
	},
	formatDate: (format = 'LL/dd/yyyy') => {
		return (value: unknown) => {
			if (_.isString(value) || _.isNumber(value) || _.isDate(value)) {
				return DateTime.fromJSDate(new Date(value)).toFormat(format);
			}
			return '';
		};
	},
	getValueProperty: (
		path: Array<string> | string,
		path2?: Array<string> | string
	) => {
		return (value: unknown) => {
			return _.get(value, path, _.get(value, path2, ''));
		};
	},
	getObjectProperty: (
		path: Array<string> | string,
		path2?: Array<string> | string
	) => {
		return (value: unknown, obj: unknown) => {
			return _.get(obj, path, _.get(obj, path2, ''));
		};
	},
	joinArray: (separator = ', ', emptyValue = '') => {
		return (values: unknown) => {
			if (Array.isArray(values) && values.length > 0) {
				return values.join(separator);
			}
			return emptyValue;
		};
	},
	mapAndJoinArray: <T, U>(
		mapFn: (value: T, index: number, array: T[]) => U,
		separator = ', ',
		emptyValue = ''
	) => {
		return (values: unknown) => {
			if (Array.isArray(values) && values.length > 0) {
				return values.map(mapFn).join(separator);
			}
			return emptyValue;
		};
	}
} as const;
