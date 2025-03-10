// eslint-disable-next-line n/no-extraneous-import
import { Request } from 'express';
import passport from 'passport';

export type VerifyCallbackFunction = (
	err: unknown,
	user: unknown,
	info?: string
) => void;

export abstract class TrustedHeadersStrategy extends passport.Strategy {
	protected constructor(private trustedHeaders: string[]) {
		super();
	}

	abstract verify(
		req: Request,
		headerValues: string[],
		callback: VerifyCallbackFunction
	): void;

	/**
	 * Authenticate request based on the contents of the dn header value.
	 *
	 * @api protected
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	authenticate(req: Request, options: unknown) {
		const headers = this.trustedHeaders.flatMap(
			(header) => req.headers[header]
		);

		try {
			// Call the configurable verify function
			this.verify(req, headers, (err, user, info) => {
				// If there was an error, pass it through
				if (err) {
					return this.error(err);
				}
				// If there was no user, fail the auth check
				if (!user) {
					return this.fail(info);
				}
				// Otherwise, succeed
				this.success(user);
			});
		} catch (error) {
			return this.error(error);
		}
	}
}
