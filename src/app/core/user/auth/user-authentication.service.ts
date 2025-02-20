import { FastifyReply, FastifyRequest } from 'fastify';

import { auditService, config } from '../../../../dependencies';
import { UnauthorizedError } from '../../../common/errors';
import accessChecker from '../../access-checker/access-checker.service';
import userEmailService from '../user-email.service';
import { IUser, UserDocument, User, UserModel } from '../user.model';

class UserAuthenticationService {
	constructor(private userModel: UserModel) {}

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

	async login(req: FastifyRequest): Promise<IUser> {
		userEmailService.welcomeNoAccessEmail(req.user).then();
		userEmailService.welcomeWithAccessEmail(req.user).then();

		// Audit the login
		auditService
			.audit(
				'User successfully logged in',
				'user-authentication',
				'authentication succeeded',
				req,
				{}
			)
			.then();

		// update the user's last login time
		const user = await this.userModel.findByIdAndUpdate(
			req.user._id,
			{ lastLogin: Date.now() },
			{ new: true, upsert: false }
		);
		return user.fullCopy();
	}

	async authenticateAndLogin(
		req: FastifyRequest,
		reply: FastifyReply
	): Promise<IUser> {
		await req.passport
			.authenticate(config.get<string>('auth.strategy'))
			.bind(req.server)(req, reply);
		if (req.user) {
			return this.login(req);
		}
		// Try to grab the username from the request
		const username =
			(req.body as Record<string, string>)?.['username'] ?? 'none provided';

		// Audit the failed attempt
		auditService
			.audit(
				'Authentication failed',
				'user-authentication',
				'authentication failed',
				req,
				{ username: username }
			)
			.then();
	}

	/**
	 * Copy fields from the access checker user to the local user
	 */
	copyACMetadata(
		dest: UserDocument,
		src: {
			name?: string;
			organization?: string;
			email?: string;
			username?: string;
			roles?: string[];
			groups?: string[];
		}
	) {
		// Only overwrite if there's a value
		if (src?.name?.trim() ?? '' !== '') {
			dest.name = src.name;
		}
		if (src?.organization?.trim() ?? '' !== '') {
			dest.organization = src.name;
		}
		if (src?.email?.trim() ?? '' !== '') {
			dest.email = src.name;
		}
		if (src?.username?.trim() ?? '' !== '') {
			dest.username = src.name;
		}

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
		const existingUser = await this.userModel
			.findOne({
				username: initializedUser.username
			})
			.exec();

		// If existing user exists, update providerData with dn
		if (existingUser) {
			existingUser.providerData.dn = dn;
			existingUser.providerData.dnLower = dn.toLowerCase();
			return existingUser.save();
		}

		// else save
		return initializedUser.save();
	}

	async autoCreateUser(dn: string, acUser: unknown, req: FastifyRequest) {
		// Create the user
		const newUser = await this.createUser(dn, acUser);

		userEmailService.signupEmail(newUser).then();
		userEmailService.welcomeNoAccessEmail(newUser).then();

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

	async verifyUser(dn: string, req: FastifyRequest, isProxy = false) {
		const dnLower = dn.toLowerCase();

		const localUser = await this.userModel
			.findOne({
				'providerData.dnLower': dnLower
			})
			.exec();

		// Bypass AC check
		if (localUser?.bypassAccessCheck) {
			return localUser;
		}

		const acUser = await accessChecker.get(dnLower);

		// Default to creating accounts automatically
		const autoCreateAccounts = config.get<boolean>('auth.autoCreateAccounts');

		// If the user is not known locally, is not known by access checker, and we are creating accounts, create the account as an empty account
		if (
			null == localUser &&
			null == acUser &&
			(isProxy || !autoCreateAccounts)
		) {
			throw new UnauthorizedError(
				'Certificate unknown, expired, or unauthorized'
			);
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

export = new UserAuthenticationService(User);
