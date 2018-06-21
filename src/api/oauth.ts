import { App } from '../lib';
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
		if ( ! this.app.rootPassword ) {
			return (req, res, next) => res.status(200).send({
				access_token: null
			});
		}

		return [
			passport.authenticate(['clientPassword'], { session: false }),
			this.server.token(),
			this.server.errorHandler()
		]
	}

	get isAuth() {
		if ( ! this.app.rootPassword) {
			return (req, res, next) => next();
		}
		return passport.authenticate('accessToken', { session: false })
	}

	constructor(private app: App) {
		// Create the server
		this.server = oauth2orize.createServer();
		this.app;
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

		passport.use("clientPassword", new ClientPasswordStrategy(this.verifyLogin.bind(this)));
		passport.use("accessToken", new BearerStrategy(this.verifyToken.bind(this)));
	}

	static getTokenFromHeaders(req): string {
		const h = req.headers['Authorization'];
		const prefix = 'Bearer ';
		if (!h.startWith(prefix)) {
			return null;
		}
		return h.substr(prefix.length)
	}

	verifyLogin(clientId, clientSecret, done) {
		console.log('rootPassword', clientSecret, this.app.rootPassword);
		if (clientId == 'admin' && clientSecret == this.app.rootPassword) {
			return done(null, { username: 'admin' })
		} else {
			return done(null, false);
		};
	}

	verifyToken(accessToken, done) {
		if (!accessToken) {
			return done(null, false);
		}
		var accessTokenHash = crypto.createHash('sha1').update(accessToken).digest('hex')
		// console.log(this.tokens);
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
