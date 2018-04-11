import { App, AppMode } from '../lib';
import * as oauth2orize from 'oauth2orize';
import * as crypto from 'crypto';

import * as passport from 'passport';
    // , BasicStrategy = require('passport-http').BasicStrategy
import { Strategy as ClientPasswordStrategy } from 'passport-oauth2-client-password';
import { Strategy as BearerStrategy } from 'passport-http-bearer';

export class OAuth {
	server: any;
	tokens: Array<{
		username: string;
		expires_in: Date;
		token: string;
		scope: string[]
	}> = []

	get token() {
		return [
			passport.authenticate(['clientPassword'], { session: false }),
			this.server.token(),
			this.server.errorHandler()
		]
	}

	get isAuth() {
		return passport.authenticate('accessToken', { session: false })
	}

	constructor(private app: App) {
		// Create the server
		this.server = oauth2orize.createServer();
	}

	initialize() {
		this.server.exchange(
			oauth2orize.exchange.clientCredentials((client, scope, done) =>
				this.generateToken().then(token => {
					//TODO: currently only memory based => need to create system entity for access tokens
					var tokenHash = crypto.createHash('sha1').update(token).digest('hex')

					this.tokens.push({
						token: tokenHash,
						expires_in: new Date(new Date().getTime() + 3600 * 48 * 1000),
						username: 'admin',
						scope: ["*"]
					});
					// Return the token
					return done(
						null /* No error*/,
						token /* The generated token*/,
						null /* The generated refresh token, none in this case */,
						null /* Additional properties to be merged with the token and send in the response */
					);
				})
			)
		);

		passport.use("clientPassword", new ClientPasswordStrategy(
			(clientId, clientSecret, done) => {
				if (clientId == 'admin' && clientSecret == 'password') {
					return done(null, { username: 'admin' })
				} else {
					return done(null, false);
				};
			}
		));

		passport.use("accessToken", new BearerStrategy(
			(accessToken, done) => {
				var accessTokenHash = crypto.createHash('sha1').update(accessToken).digest('hex')
				console.log(this.tokens);
				const token = this.tokens.find(token => token.token == accessTokenHash)
				if (!token) return done(null, false)
				if (new Date() > token.expires_in) {
					this.clearExpiredTokens();
					done(null, false);
				} else {
					var info = { scope: '*' }
					done(null, { username: 'admin' }, info);
				}
			}
		));
	}

	private clearExpiredTokens() {
		this.tokens = this.tokens.filter(token => {
			return token.expires_in.getTime() <= new Date().getTime()
		})
	}

	private generateToken({ stringBase = 'base64', byteLength = 32 } = {}): Promise<string> {
		return new Promise((resolve, reject) => {
			crypto.randomBytes(byteLength, (err, buffer) => {
				if (err) {
					reject(err);
				} else {
					resolve(buffer.toString(stringBase));
				}
			});
		});
	}
}
