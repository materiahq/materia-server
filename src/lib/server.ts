import chalk from 'chalk';
import * as express from 'express';
import * as passport from 'passport';
import * as morgan from 'morgan';
import * as methodOverride from 'method-override';
import * as bodyParser from 'body-parser';
import * as errorHandler from 'errorhandler';
import * as compression from 'compression';
import { join } from 'path';
import { existsSync } from 'fs-extra';
import { createServer, Server as HttpServer } from 'http';
import { IServerConfig, IClientConfig, IAppConfig, IConfigOptions } from '@materia/interfaces';

import { App, AppMode } from './app';
import { ConfigType } from './config';
import { Session } from './session';
import { WebsocketServers } from './websocket';

/**
 * @class Server
 * @classdesc
 * Represent the server
 */
export class Server {
	dynamicStatic: any;
	started = false;
	disabled = false;

	expressApp: express.Application;
	passport: any = passport;
	websocket: WebsocketServers;
	server: HttpServer;
	session: Session;

	private config: IServerConfig;
	private sockets = new Map();
	private stopped = false;

	constructor(private app: App) {
		this.session = new Session(app);
	}

	load() {
		const conf = this.app.config.get<IServerConfig>(this.app.mode, ConfigType.SERVER);

		this.expressApp = express();
		this.expressApp.use(bodyParser.urlencoded(Object.assign({}, { extended: false }, conf.bodyParser && conf.bodyParser.urlencoded || {})));
		this.expressApp.use(bodyParser.json(conf.bodyParser && conf.bodyParser.json));
		this.expressApp.use(methodOverride());
		this.expressApp.use(compression());

		if ((this.app.mode == AppMode.DEVELOPMENT || this.app.options.logRequests) && this.app.options.logRequests != false) {
			this.expressApp.use(morgan('dev'));
		}
		if (conf.cors == null || conf.cors) {
			this.expressApp.use(function (req, res, next) {
				res.header('Access-Control-Allow-Origin', '*');
				res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,DELETE');
				res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
				next();
			});
		}

		this.expressApp.use(errorHandler());

		this.server = createServer(this.expressApp);

		this.websocket = new WebsocketServers(this.app);

		this.sockets = new Map();
		this.stopped = false;
		this._listenConnections();
	}

	createDynamicStatic(path) {
		let staticFolder = express.static(path);
		this.dynamicStatic = function (req, res, next) {
			return staticFolder(req, res, next);
		};

		// Method to change static path at runtime
		this.dynamicStatic.setPath = (newPath) => {
			staticFolder = express.static(newPath);
		};
		return this.dynamicStatic;
	}

	/**
	Get the base url for endpoints
	@returns {string}
	*/
	getBaseUrl(path?: string, mode?: AppMode, options?: IConfigOptions) {
		path = path || '/api';
		mode = mode || this.app.mode;
		const appConf = this.app.config.get<IAppConfig>(
			mode,
			ConfigType.APP,
			options
		);
		if (mode == AppMode.PRODUCTION && appConf.live && appConf.live.url) {
			let base = appConf.live.url;
			if (base.substr(base.length - 1, 1) == '/') {
				base = base.substr(0, base.length - 1);
			}
			return base + path;
		}
		const conf = this.app.config.get<IServerConfig>(mode, ConfigType.SERVER, options);
		if (!conf) {
			return '';
		}
		let url = `${conf.ssl ? 'https' : 'http'}://${conf.host}`;
		if (conf.port != 80) {
			url += ':' + conf.port;
		}
		url += path;
		return url;
	}

	/**
	Return true if the server is started
	@returns {boolean}
	*/
	isStarted(): boolean { return this.started; }

	/**
	Return true if the server has a static page
	@returns {boolean}
	*/
	hasStatic() {
		// DEPRECATED or should call this.app.client.hasIndexFile() as it's not the concern of the server implementation to know about the client
		const clientConfig: IClientConfig = this.app.config.get(this.app.mode, ConfigType.CLIENT);
		let p;
		if (clientConfig && clientConfig.www) {
			p = clientConfig.www;
		} else {
			p = 'client';
		}
		return existsSync(join(this.app.path, p, 'index.html'));
	}

	/**
	Starts the server and listen on its endpoints.
	@returns {Promise<number>}
	*/
	start(opts?: any): Promise<number> {
		const clientConfig: IClientConfig = this.app.config.get(this.app.mode, ConfigType.CLIENT);
		return new Promise<number>((resolve, reject) => {
			this.stop().then(() => {
				if (! opts || ! opts.fallback) {

					let webDir;
					// console.log(clientConfig);
					if (clientConfig && clientConfig.www) {
						webDir = clientConfig.www;
					} else {
						webDir = 'client';
					}

					// Initialize dynamic Express static Object.
					this.createDynamicStatic(join(this.app.path, webDir));
					this.expressApp.use(this.dynamicStatic);
					this.app.api.registerEndpoints();
					this.expressApp.all('/api/*', (req, res) => {
						res.status(404).send({
							error: true,
							message: 'API endpoint not found'
						});
					});

					this.expressApp.all('/*', (req, res) => {
						if (clientConfig && existsSync(join(this.app.path, clientConfig.www, '404.html'))) {
							res.sendFile(join(this.app.path, clientConfig.www, '404.html'));
						} else if (this.hasStatic()) {
							res.sendFile(join(this.app.path, clientConfig.www, 'index.html'));
						} else {
							res.status(404).send({
								error: true,
								message: 'API endpoint not found'
							});
						}
					});

					this.expressApp.use((err: any, req: express.Request, res: express.Response) => {
						res.status(500).send({
							error: true,
							message: (err && err.message) || 'Unexpected error'
						});
						return this.expressApp;
					});

					if (this.disabled) {
						this.app.logger.log(' └── Server: Disabled (Warning)');
						return resolve(0);
					}
				}
				this.config = this.app.config.get<IServerConfig>(this.app.mode, ConfigType.SERVER);
				let port = opts && opts.port || this.app.options && this.app.options.port || this.config && this.config.port || 8080;
				if (this.app.mode == AppMode.PRODUCTION && process.env.GCLOUD_PROJECT && process.env.PORT) {
					port = +process.env.PORT;
				}
				if ( ! port) {
					if (AppMode.DEVELOPMENT === this.app.mode) {
						port = 8080;
					} else {
						port = 80;
					}
				}

				let error = 0;
				const errListener = (e) => {
					if (e.code == 'EADDRINUSE' || (e.code === 'EACCES' && e.syscall === 'listen' && e.port === port)) {
						this.app.logger.error(new Error(`Impossible to start the server - The port ${port} is already used by another server.`));
						if (this.app.mode == AppMode.DEVELOPMENT) {
							if ( ! opts ) { opts = {}; }
							if ( ! opts.port) { opts.port = port; }
							error = opts.port;
							opts.port = opts.port + 1;
							return this.start(opts).then(resolve).catch(reject);
						}
					} else {
						this.app.logger.error(new Error('Impossible to start the server - ' + e.message));
					}
					return reject(e);
				};

				const args = [port, this.config && this.config.host || 'localhost', () => {
					if (port == error) {
						return;
					}
					this.started = true;
					this.app.logger.log(` └─┬ Server: ${chalk.green.bold('Started')}`);
					if (this.config && this.config.host == '0.0.0.0' || process.env.NO_HOST) {
						this.app.logger.log('   └─ Listening on ' + chalk.blue.bold.underline(`http://localhost:${port}`) + '\n');
					} else {
						this.app.logger.log(
							'   └─ Listening on ' + chalk.blue.bold.underline('http://' + (this.config && this.config.host || 'localhost') + ':' + port) + '\n'
						);
					}
					this.server.removeListener('error', errListener);
					return resolve(port);
				}];

				// special IP - "no host"
				if (this.config && this.config.host == '0.0.0.0' || process.env.NO_HOST) {
					// remove the host from args
					args[1] = args.pop();
				}
				if (this.server.listeners('error').length) {
					this.server.removeAllListeners('error');
				}
				this.server.listen.apply(this.server, args).on('error', errListener);
			});
		});
	}

	/**
	Stops the server.
	*/
	stop(): Promise<void> {
		if ( ! this.server || ! this.started ) {
			return Promise.resolve();
		}

		return new Promise<void>(accept => {
			this.websocket.close();
			this.server.close(() => {
				this.app.logger.log('\n' + chalk.bold('(Stop)') + ' Server closed\n');
				this.started = false;
				accept();
			});
			this.stopped = true;
			setImmediate(() => {
				this.sockets.forEach((reqs, socket) => {
					socket.end();
					socket.destroy();
				});
			});
		});
	}

	private _onConnection(socket) {
		this.sockets.set(socket, 0);
		socket.once('close', () => this.sockets.delete(socket));
	}

	private _onRequest(req, res) {
		this.sockets.set(req.socket, this.sockets.get(req.socket) + 1);
		res.once('finish', () => {
			const pending = this.sockets.get(req.socket) - 1;
			this.sockets.set(req.socket, pending);
			if (this.stopped && pending === 0) {
				req.socket.end();
				req.socket.destroy();
			}
		});
	}

	private _listenConnections() {
		this.server.on('connection', socket => this._onConnection(socket));
		this.server.on('secureConnection', socket => this._onConnection(socket));
		this.server.on('request', (req, res) => this._onRequest(req, res));
	}
}