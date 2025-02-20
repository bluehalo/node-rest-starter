import _ from 'lodash';
import { FilterQuery, SortOrder, Types } from 'mongoose';
import platform from 'platform';

import { IdOrObject } from './typescript-util';

export const validateNonEmpty = function (property?: string) {
	return null != property && property.length > 0;
};

export const toLowerCase = function (v: string | null) {
	return null == v ? undefined : v.toLowerCase();
};

/**
 * Parse an input as a date. Handles various types
 * of inputs, such as Strings, Date objects, and Numbers.
 *
 * @param date The input representing a date / timestamp
 * @returns The timestamp in milliseconds since the Unix epoch
 */
export const dateParse = function (
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	date: string | number | Date | Array<unknown> | Function | object
) {
	// Handle nil values, arrays, and functions by simply returning null
	if (_.isNil(date) || Array.isArray(date) || _.isFunction(date)) {
		return null;
	}

	// Date object should return its time in milliseconds
	if (_.isDate(date)) {
		return date.getTime();
	}

	// A number that exists will be interpreted as millisecond
	if (_.isFinite(date)) {
		return date;
	}

	// Handle number string
	if (!isNaN(date as number)) {
		return +date;
	}

	// Handle String, Object, etc.
	const parsed = Date.parse(date as string);

	// A string that cannot be parsed returns NaN
	if (isNaN(parsed)) {
		return null;
	}

	return parsed;
};

/**
 * Get the limit provided by the user, if there is one.
 * Limit has to be at least 1 and no more than 100, with
 * a default value of 20.
 */
export const getLimit = (
	queryParams: { size?: number },
	maxSize = 100
): number => {
	const limit = queryParams?.size ?? 20;
	return isNaN(limit) ? 20 : Math.max(1, Math.min(maxSize, Math.floor(limit)));
};

/**
 * Page needs to be positive and has no upper bound
 */
export const getPage = (queryParams: { page?: number }): number => {
	const page = queryParams?.page ?? 0;
	return isNaN(page) ? 0 : Math.max(0, page);
};

/**
 * Get the sort provided by the user, if there is one.
 * Limit has to be at least 1 and no more than 100, with
 * a default value of 20.
 */
export const getSort = (
	queryParams: { sort?: string; dir?: string },
	defaultDir = 'ASC',
	defaultSort?: string
) => {
	const sort = queryParams?.sort ?? defaultSort;
	const dir = queryParams?.dir ?? defaultDir;
	if (!sort) {
		return null;
	}
	return [{ property: sort, direction: dir }];
};

/**
 * Get the sort provided by the user, if there is one.
 */
export const getSortObj = function (
	queryParams: { sort?: string; dir?: string | 1 | -1 },
	defaultDir: 'ASC' | 'DESC' = 'ASC',
	defaultSort?: string
): { [key: string]: SortOrder } | null {
	const sort = queryParams?.sort ?? defaultSort;
	const dir = queryParams?.dir ?? defaultDir;
	if (!sort) {
		return null;
	}

	return { [sort]: dir === 'ASC' ? 1 : -1 };
};

/**
 * Extract given field from request header
 */
export const getHeaderField = (
	header: Record<string, string | string[]>,
	fieldName: string
) => {
	return header?.[fieldName] ?? null;
};

/**
 * Parses user agent information from request header
 */
export const getUserAgentFromHeader = (
	header: Record<string, string | string[]>
) => {
	const userAgent = getHeaderField(header, 'user-agent');

	let data = {};
	if (null != userAgent) {
		const info = platform.parse(userAgent);
		data = {
			browser: `${info.name} ${info.version}`,
			os: info.os.toString()
		};
	}

	return data;
};

const isMongooseDateValue = (obj: unknown): obj is { $date: string } => {
	return typeof obj === 'object' && '$date' in obj;
};

const isMongooseObjValue = (obj: unknown): obj is { $obj: string } => {
	return typeof obj === 'object' && '$obj' in obj;
};

function propToMongoose(
	prop: unknown,
	nonMongoFunction: (prop: unknown) => unknown
) {
	if (isMongooseDateValue(prop)) {
		return new Date(prop.$date);
	}
	if (isMongooseObjValue(prop)) {
		return new Types.ObjectId(prop.$obj);
	}
	return nonMongoFunction(prop);
}

export const toMongoose = <T = unknown>(
	obj: FilterQuery<T>
): FilterQuery<T> => {
	if (obj && typeof obj === 'object') {
		if (Array.isArray(obj)) {
			return obj.map((value) => propToMongoose(value, toMongoose));
		}
		const newObj: Record<string, unknown> = {};
		for (const key of Object.keys(obj)) {
			newObj[key] = propToMongoose(obj[key], toMongoose);
		}
		return newObj;
	}
	return obj;
};

export const emailMatcher = /.+@.+\..+/;

/**
 * Given an array of values, remove the values ending with a wildcard character (*)
 * @param stringArray - an array of string values
 * @return an array of the strings removed from the input list because they end with a '*' character
 */
export const removeStringsEndingWithWildcard = (stringArray: string[]) => {
	return _.remove(stringArray, (value) => {
		return _.endsWith(value, '*');
	});
};

/**
 * Escapes regex-specific characters in a given string
 */
export const escapeRegex = (str: string) => {
	return `${str}`.replaceAll(/[.?*+^$[\]\\(){}|-]/g, String.raw`\$&`);
};

export const getId = <T>(obj: IdOrObject<T>) => {
	if (typeof obj === 'object' && '_id' in obj) {
		return obj._id;
	}
	return obj;
};
