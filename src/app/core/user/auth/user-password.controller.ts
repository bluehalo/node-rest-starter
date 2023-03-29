import userPasswordService from './user-password.service';

/**
 * Forgot for reset password (forgot POST)
 */
export const forgot = async (req, res) => {
	// Make sure there is a username
	if (!req.body.username) {
		return res.status(400).json({ message: 'Username is missing.' });
	}

	try {
		const token = await userPasswordService.generateToken();

		const user = await userPasswordService.setResetTokenForUser(
			req.body.username,
			token
		);

		await userPasswordService.sendResetPasswordEmail(user, token, req);

		res
			.status(200)
			.json(
				`An email has been sent to ${user.email} with further instructions.`
			);
	} catch (error) {
		res
			.status(400)
			.json({ message: 'Failure generating reset password token.' });
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
		return res.status(400).json({ message: 'invalid-token' });
	}
	res.status(200).json({ message: 'valid-token' });
};

/**
 * Reset password POST from email token
 */
export const reset = async (req, res) => {
	// Init Variables
	const password = req.body.password;

	// Make sure there is a password
	if (!password) {
		return res.status(400).json({ message: 'Password is missing.' });
	}

	try {
		const user = await userPasswordService.resetPasswordForToken(
			req.params.token,
			req.body.password
		);

		await userPasswordService.sendPasswordResetConfirmEmail(user, req);

		res
			.status(200)
			.json(
				`An email has been sent to ${user.email} letting them know their password was reset.`
			);
	} catch (error) {
		res.status(400).json({ message: 'Failure resetting password.' });
	}
};
