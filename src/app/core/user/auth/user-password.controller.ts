import { StatusCodes } from 'http-status-codes';

import userPasswordService from './user-password.service';
import { BadRequestError } from '../../../common/errors';

/**
 * Forgot for reset password (forgot POST)
 */
export const forgot = async (req, res) => {
	// Make sure there is a username
	if (!req.body.username) {
		throw new BadRequestError('Username is missing.');
	}

	try {
		const token = await userPasswordService.generateToken();

		const user = await userPasswordService.setResetTokenForUser(
			req.body.username,
			token
		);

		await userPasswordService.sendResetPasswordEmail(user, token, req);

		res
			.status(StatusCodes.OK)
			.json(
				`An email has been sent to ${user.email} with further instructions.`
			);
	} catch (error) {
		throw new BadRequestError('Failure generating reset password token.');
	}
};

/**
 * Reset password GET from email token
 */
export const validateResetToken = async (req, res) => {
	const user = await userPasswordService.findUserForActiveToken(
		req.params.token
	);

	if (!user) {
		throw new BadRequestError('invalid-token');
	}
	res.status(StatusCodes.OK).json({ message: 'valid-token' });
};

/**
 * Reset password POST from email token
 */
export const reset = async (req, res) => {
	// Init Variables
	const password = req.body.password;

	// Make sure there is a password
	if (!password) {
		throw new BadRequestError('Password is missing.');
	}

	try {
		const user = await userPasswordService.resetPasswordForToken(
			req.params.token,
			req.body.password
		);

		await userPasswordService.sendPasswordResetConfirmEmail(user, req);

		res
			.status(StatusCodes.OK)
			.json(
				`An email has been sent to ${user.email} letting them know their password was reset.`
			);
	} catch (error) {
		throw new BadRequestError('Failure resetting password.');
	}
};
