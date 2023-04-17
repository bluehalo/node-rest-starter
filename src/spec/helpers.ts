/**
 * this takes an object, converts stringifies it and then parses it back out.
 * this is useful when fields are Date objects and need to be compared to a
 * stringified version
 * @param {*} json
 * @returns
 */
export const parsedJSON = (json) => {
	if (json === null) return null;
	if (typeof json === 'undefined') return undefined;
	return JSON.parse(JSON.stringify(json));
};

/**
 * according to the internet this is a legit way to check if a string is
 * an iso string
 * @param {*} val
 * @returns
 */
export const isISOString = (val) => {
	const d = new Date(val);
	return !Number.isNaN(d.valueOf()) && d.toISOString() === val;
};
