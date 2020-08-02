import * as fs from 'fs';
import * as path from 'path';
import * as express from 'express';
import chalk = require('chalk');
import { IAddon, IEndpoint, IApplyOptions } from '@materia/interfaces';

import { Endpoint } from './api/endpoint';
import { Permissions } from './api/permissions';
import { App, AppMode } from './app';
import { MateriaError } from './error';
import { VirtualEntity } from './entities/virtual-entity';

/**
 * @class Api
 * @classdesc
 * This class is used to set the endpoints on the server
 * @property {Permissions} permissions - The access to the permission filters
 */
export class Api {
	endpoints: Endpoint[];
	permissions: Permissions;
	router: express.Router;

	constructor(private app: App) {
		this.endpoints = [];
		this.permissions = new Permissions(app);
	}

	/**
	Check if an endpoint is registered
	@param {object} - Endpoint's description. must contain at leat `method` and `url`
	@returns {boolean}
	*/
	exists(endpoint: IEndpoint): boolean {
		return !!this.get(endpoint.method, endpoint.url);
	}

	/**
	Add an endpoint to the server. This will replace any registered endpoint matching the `url` and `method`.
	@param {object} - Endpoint's description
	@param {object} - Action's options
	*/
	add(endpoint: IEndpoint, options?: IApplyOptions) {
		options = options || {};

		if ( ! endpoint.controller && endpoint.query && endpoint.query.entity &&
			! (this.app.entities.get(endpoint.query.entity) instanceof VirtualEntity) && this.app.database.disabled) {
			throw new MateriaError('The database is disabled and this endpoint rely on it');
		}
		if (endpoint) {
			if (options.fromAddon) {
				endpoint.fromAddon = options.fromAddon;
			}
			const obj = new Endpoint(this.app, endpoint);
			if (this.exists(endpoint)) {
				this.remove(endpoint.method, endpoint.url, options);
			}
			this.endpoints.push(obj);
			if (options.apply != false) {
				this.updateEndpoints();
			}
			if (options.save != false) {
				this.save(options);
			}
		}
	}

	/**
	Replace an endpoint at the `pos` index in the endpoints' array.
	@param {object} - Endpoint's description
	@param {integer} - Position in the array
	@param {object} - Action's options
	*/
	put(endpoint: IEndpoint, pos, options: IApplyOptions) {
		options = options || {};
		this.endpoints[pos] = new Endpoint(this.app, endpoint);
		if (options.apply != false) {
			this.updateEndpoints();
		}
		if (options.save != false) {
			this.save(options);
		}
	}

	/**
	Remove a registered endpoint.
	@param {string} - HTTP method. `get`, `post`, `put` or `delete`
	@param {string} - HTTP url relative to the API base.
	@param {object} - Action's options
	*/
	remove(method: string, url: string, options?: IApplyOptions) {
		options = options || {};
		const index = this.endpoints.findIndex((e) => e.url === url && e.method === method);
		const endpoint = this.endpoints[index];
		this.endpoints.splice(index, 1);
		if (options.apply != false) {
			this.updateEndpoints();
		}
		if (options.save != false) {
			const opts: IApplyOptions = Object.assign({}, options);
			opts.fromAddon = endpoint.fromAddon;
			this.save(opts);
		}
		return;
	}

	/**
	Remove all registered endpoint.
	@param {object} - Action's options
	*/
	removeAll(options?: IApplyOptions): void {
		if (this.endpoints && this.endpoints.length) {
			const endpoints = this.findAll().map((e) => e.toJson());
			endpoints.forEach((e) => {
				this.remove(e.method, e.url, Object.assign({}, options, {apply: false}));
			});
			if (options.apply != false) {
				this.updateEndpoints();
			}
		}
	}

	/**
	Get a registered endpoint.
	@param {string} - HTTP method. `get`, `post`, `put` or `delete`
	@param {string} - HTTP url relative to the API base.
	@returns {Endpoint}
	*/
	get(method: string, url: string): Endpoint {
		return this.endpoints.find(endpoint => endpoint.url == url && endpoint.method == method);
	}

	/**
	Get all endpoints
	@returns {Array<Endpoint>}
	*/
	findAll() { return this.endpoints; }

	load(addon?: IAddon): Promise<any> {
		const basePath = addon ? addon.path : this.app.path;
		const opts: IApplyOptions = {
			save: false
		};
		if (addon) {
			opts.fromAddon = addon;
		}
		this.permissions.load();
		let content;
		try {
			content = fs.readFileSync(path.join(basePath, 'server', 'api.json'));
		} catch (e) {
			return Promise.resolve();
		}

		try {
			const endpoints = JSON.parse(content.toString());

			if (endpoints.length > 0) {
				if (addon) {
					this.app.logger.log(` │ └─┬ ${addon.package}`);
				} else {
					this.app.logger.log(` │ └─┬ Application`);
				}
			}

			endpoints.forEach((endpoint) => {
				try {
					this.app.logger.log(` │ │ └── ${this.getMethodColor(endpoint.method.toUpperCase())} ${chalk.bold('/api' + endpoint.url)}`);
					this.add(endpoint, opts);
				} catch (e) {
					this.app.logger.warn(`┬┴─┴─┴   ${chalk.bold.yellow('Skipped')} due to the following error`);
					this.app.logger.warn(e);
				}
			});
		} catch (e) {
			if (e.code != 'ENOENT') {
				this.app.logger.error(' │ │ └── Error loading endpoints');
				this.app.logger.error(e.stack);
			} else {
				return Promise.reject(e);
			}
		}
		return Promise.resolve();
	}

	getMethodColor(method) {
		if (method == 'GET') {
			return chalk.green.bold('GET');
		} else if (method == 'POST') {
			return chalk.blue.bold('POST');
		} else if (method == 'PUT') {
			return chalk.yellow.bold('PUT');
		} else if (method == 'DELETE') {
			return chalk.red.bold('DELETE');
		} else { return chalk.bold(method.toUpperCase()); }
	}

	updateEndpointHttp(endpoint) {
		const route = this.router[endpoint.method.toLowerCase()];
		route.call(this.router, endpoint.url, this.permissions.check(endpoint.permissions), (req, res, next) => {
			const endpointResult = endpoint.handle(req, res, next);
			if (endpointResult && endpointResult.catch) {
				endpointResult.catch((e) => {
					if (e instanceof Error) {
						e = {
							error: true,
							message: e.message
						};
					}
					if (this.app.mode != AppMode.PRODUCTION) {
						e.stack = e.stack;
					}
					if (! res.headerSent) {
						res.status(e.statusCode || 500).send(e);
					}
				});
			}
		});
	}

	updateEndpointWS(endpoint) {
		const wss = this.app.server.websocket.register(endpoint.url);
		endpoint.handle(wss, null, () => {});
	}

	updateEndpoints() {
		this.router = express.Router();
		this.endpoints.forEach((endpoint) => {
			if (endpoint.method.toLowerCase() !== 'ws') {
				this.updateEndpointHttp(endpoint);
			} else {
				this.updateEndpointWS(endpoint);
			}
		});
	}

	resetControllers() {
		Endpoint.resetControllers();
	}

	registerEndpoints() {
		const appServer = this.app.server.expressApp;

		this.updateEndpoints();
		appServer.use('/api', (req, res, next) => {
			return this.router(req, res, next);
		});
	}

	/**
	Get the endpoints array in the `api.json` format
	@returns {Array<object>}
	*/
	toJson(opts?: IApplyOptions) {
		const res = [];
		this.endpoints.forEach((endpoint) => {

			if (! opts || opts.fromAddon == endpoint.fromAddon) {
				res.push(endpoint.toJson());
			}
		});
		return res;
	}

	save(opts?: IApplyOptions) {
		if ( ! opts || ! opts.fromAddon) {
			fs.writeFileSync(path.join(this.app.path, 'server', 'api.json'), JSON.stringify(this.toJson(opts), null, '\t'));
		}
	}

	getControllers() {
		return Object.keys(Endpoint.controllers);
	}
}
