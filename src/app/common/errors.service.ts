/**
 * Get unique error field name
 */
function getUniqueErrorMessage(err) {
	let output;

	try {
		const fieldName = err.err.substring(
			err.err.lastIndexOf('.$') + 2,
			err.err.lastIndexOf('_1')
		);
		output = `${
			fieldName.charAt(0).toUpperCase() + fieldName.slice(1)
		} already exists`;
	} catch (ex) {
		output = 'Unique field already exists';
	}

	return output;
}

/**
 * Get the error message from error object
 */
export const getErrorMessage = function (err) {
	let message = '';

	if (null == err || typeof err === 'string') {
		message = err;
	} else if (err.code) {
		switch (err.code) {
			case 11000:
			case 11001:
				message = getUniqueErrorMessage(err);
				break;
			default:
				message = 'Something went wrong';
		}
	} else if (err.errors) {
		const linebreak = '\n';

		for (const errName in err.errors) {
			if (err.errors[errName].message) {
				message += err.errors[errName].message + linebreak;
			}
		}

		if (message.indexOf(linebreak, message.length - linebreak.length) !== -1) {
			message = message.substr(0, message.length - linebreak.length);
		}
	} else {
		message = 'Unknown error';
	}

	return message;
};
