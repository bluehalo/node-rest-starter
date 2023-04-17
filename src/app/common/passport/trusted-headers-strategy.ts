import { Request } from 'express';
import passport from 'passport';

export abstract class TrustedHeadersStrategy extends passport.Strategy {
	protected constructor(private trustedHeaders: string[]) {
		super();
	}

	abstract verify(req: Request, headerValues, callback);

	/**
	 * Authenticate request based on the contents of the dn header value.
	 *
	 * @api protected
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	authenticate(req: Request, options) {
		const headers = this.trustedHeaders.map((header) => req.headers[header]);

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
		} catch (ex) {
			return this.error(ex);
		}
	}
}
