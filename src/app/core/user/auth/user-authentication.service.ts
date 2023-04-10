import passport from 'passport';

import { auditService, config, dbs } from '../../../../dependencies';
import accessChecker from '../../access-checker/access-checker.service';
import userEmailService from '../user-email.service';
import { IUser, UserDocument, UserModel } from '../user.model';

const User: UserModel = dbs.admin.model('User');

class UserAuthenticationService {
	/**
	 * Initialize a new user
	 * This method applies any common business logic that happens
	 * when a new user is created in the system.
	 */
	initializeNewUser(user: UserDocument): Promise<UserDocument> {
		// Previously this handled setting default roles, but that is now handled by the model
		// Resolve the user (this might seem like overkill, but planning for the future)
		return Promise.resolve(user);
	}

	/**
	 * Login the user
	 * Does the work to log the user into the system
	 * Updates the last logged in time
	 * Audits the action
	 */
	login(user: UserDocument, req): Promise<IUser> {
		return new Promise((resolve, reject) => {
			// Calls the login function (which goes to passport)
			req.login(user, (err) => {
				if (err) {
					return reject({ status: 500, type: 'login-error', message: err });
				}

				userEmailService.welcomeWithAccessEmail(user, req);

				// update the user's last login time
				User.findOneAndUpdate(
					{ _id: user._id },
					{ lastLogin: Date.now() },
					{ new: true, upsert: false },
					(_err, _user: UserDocument) => {
						if (_err) {
							return reject({
								status: 500,
								type: 'login-error',
								message: _err
							});
						}
						return resolve(_user.fullCopy());
					}
				);

				// Audit the login
				auditService.audit(
					'User successfully logged in',
					'user-authentication',
					'authentication succeeded',
					req,
					{}
				);
			});
		});
	}

	/**
	 * Authenticate and then login depending on the outcome
	 */
	authenticateAndLogin(req, res, next): Promise<IUser> {
		return new Promise((resolve, reject) => {
			// Attempt to authenticate the user using passport
			passport.authenticate(config.auth.strategy, (err, user, info, status) => {
				// If there was an error
				if (err) {
					// Reject the promise with a 500 error
					return reject({
						status: 500,
						type: 'authentication-error',
						message: err
					});
				}
				// If the authentication failed
				if (!user) {
					// In the case of a auth failure, info should have the reason
					// Here is a hack for the local strategy...
					if (null == info.status && null != status) {
						info.status = status;
						if (info.message === 'Missing credentials') {
							info.type = 'missing-credentials';
						}
					}

					// Try to grab the username from the request
					const username =
						req.body && req.body.username ? req.body.username : 'none provided';

					// Audit the failed attempt
					auditService.audit(
						info.message,
						'user-authentication',
						'authentication failed',
						req,
						{ username: username }
					);

					return reject(info);
				}
				// Else the authentication was successful
				// Set the user ip if available.
				user.ip = req.headers?.['x-real-ip'] ?? null;
				this.login(user, req).then(resolve).catch(reject);
			})(req, res, next);
		});
	}

	copyACMetadata(dest, src) {
		// Copy each field from the access checker user to the local user
		['name', 'organization', 'email', 'username'].forEach((e) => {
			// Only overwrite if there's a value
			if (src?.[e]?.trim() ?? '' !== '') {
				dest[e] = src[e];
			}
		});

		// Always overwrite these fields
		dest.externalRoles = src?.roles ?? [];
		dest.externalGroups = src?.groups ?? [];
		return dest;
	}

	/**
	 * Create the user locally given the information from access checker
	 */
	async createUser(dn: string, acUser: unknown): Promise<UserDocument> {
		// Create the new user
		const newUser = new User({
			name: 'unknown',
			organization: 'unknown',
			organizationLevels: {},
			email: 'unknown@mail.com',
			username: dn.toLowerCase()
		});

		// Copy over the access checker metadata
		this.copyACMetadata(newUser, acUser);

		// Add the provider data
		newUser.providerData = { dn: dn, dnLower: dn.toLowerCase() };
		newUser.provider = 'pki';

		// Initialize the new user
		const initializedUser = await this.initializeNewUser(newUser);

		// Check for existing user with same username
		const existingUser = await User.findOne({
			username: initializedUser.username
		}).exec();

		// If existing user exists, update providerData with dn
		if (existingUser) {
			existingUser.providerData.dn = dn;
			existingUser.providerData.dnLower = dn.toLowerCase();
			return existingUser.save();
		}

		// else save
		return initializedUser.save();
	}

	async autoCreateUser(dn: string, acUser: unknown, req) {
		// Create the user
		const newUser = await this.createUser(dn, acUser);

		userEmailService.signupEmail(newUser, req);
		userEmailService.welcomeNoAccessEmail(newUser, req);

		// Audit user signup
		await auditService.audit(
			'user signup',
			'user',
			'user signup',
			req,
			newUser.auditCopy()
		);

		return newUser;
	}

	async verifyUser(dn: string, req, isProxy = false) {
		const dnLower = dn.toLowerCase();

		const localUser = await User.findOne({
			'providerData.dnLower': dnLower
		}).exec();

		// Bypass AC check
		if (localUser?.bypassAccessCheck) {
			return localUser;
		}

		const acUser = await accessChecker.get(dnLower);

		// Default to creating accounts automatically
		const autoCreateAccounts = config?.auth?.autoCreateAccounts ?? true;

		// If the user is not known locally, is not known by access checker, and we are creating accounts, create the account as an empty account
		if (
			null == localUser &&
			null == acUser &&
			(isProxy || !autoCreateAccounts)
		) {
			throw {
				status: 401,
				type: 'invalid-credentials',
				message: 'Certificate unknown, expired, or unauthorized'
			};
		}

		// Else if the user is not known locally, and we are creating accounts, create the account as an empty account
		if (null == localUser && autoCreateAccounts) {
			return this.autoCreateUser(dn, acUser, req);
		}

		// update local user with is known locally, but not in access checker, update their user info to reflect
		this.copyACMetadata(localUser, acUser);

		// Audit user update
		await auditService.audit(
			'user updated from access checker',
			'user',
			'update',
			req,
			localUser.auditCopy()
		);

		return localUser.save();
	}
}

export = new UserAuthenticationService();
