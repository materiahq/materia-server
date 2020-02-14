import chalk from 'chalk';
import { IEndpoint, IParam } from '@materia/interfaces';

import { App } from '../app';
import { MateriaError } from '../error';
import { Controller } from './controller';
import { Entity } from '../entities/entity';
import { Query } from '../entities/query';

// Not used yet
export enum Method {
	GET,
	POST,
	PUT,
	DELETE,
	PATCH
}
/*
	data format:
	{
		name: string,
		desc: string,
		method: string (GET|POST|PUT|DELETE|PATCH)
		url: string
		base: string
		params: array
		data: array
		action: string (QUERY|JS|SQL)
		file: path (if action == CODE)
		query: {
			entity: string
			id: string (queryId)
		}
	}
*/

export class Endpoint {
	name: string;
	method: string;
	url: string;
	fromAddon?: IEndpoint['fromAddon'];

	entity: Entity;
	params: Array<IParam>;
	data: Array<IParam>;
	permissions: Array<string>;

	controller: string;
	action: string;

	query: Query;
	queryStr: string;

	static controllers: {[name: string]: Controller} = {};

	static resetControllers(): void {
		Endpoint.controllers = {};
	}

	constructor(private app: App, endpointConfig: IEndpoint) {
		this.method = (endpointConfig.method && endpointConfig.method.toLowerCase()) || 'get';

		// this.name = endpointConfig.name
		// this.desc = endpointConfig.desc
		this.url = endpointConfig.url;
		this.fromAddon = endpointConfig.fromAddon;

		this.params = [];
		this.data = [];
		this.permissions = endpointConfig.permissions || [];

		/*if (typeof endpointConfig.query == 'function') {
			this.params = endpointConfig.params || []
			this.data = endpointConfig.data || []
			this.query = endpointConfig.query
		}*/

		if (endpointConfig.controller) {
			this.controller = endpointConfig.controller;
			this.action = endpointConfig.action;

			const basePath = this.fromAddon ? this.fromAddon.path : this.app.path;

			const ctrl = this._getController();
			ctrl.load(basePath, this.controller);
			if ( ! ctrl.ctrlClass.prototype[this.action]) {
				throw new MateriaError(`Could not find method ${this.action} in controller ${this.controller}.ctrl.js`);
			}
			this._buildParams(endpointConfig.params);
		} else {
			let entity_name;
			if (typeof endpointConfig.query.entity == 'string') {
				entity_name = endpointConfig.query.entity;
			}

			this.entity = this.app.entities.get(entity_name);

			if ( ! this.entity) {
				throw new MateriaError('Could not find entity ' + entity_name);
			}

			this.query = this.entity.getQuery(endpointConfig.query.id);

			if ( ! this.query ) {
				throw new MateriaError('Could not find query "' + endpointConfig.query.id + '" of entity ' + this.entity.name);
			}
			this._buildParams(this.query.params);
		}
	}

	getParam(name: string): IParam {
		return this.data.find(param => param.name === name);
	}

	getData(name: string): IParam {
		return this.data.find(param => param.name === name);
	}

	getAllData(onlyRequired?: boolean): IParam[] {
		return this.data.filter(param => param.required && onlyRequired || ! onlyRequired);
	}


	getAllParams(onlyRequired?: boolean): IParam[] {
		return this.params.filter(param => param.required && onlyRequired || ! onlyRequired);
	}

	getRequiredParams(): IParam[] {
		return this.getAllParams(true);
	}

	getRequiredData(): IParam[] {
		return this.getAllData(true);
	}

	handle(req, res, next): Promise<any> {
		if (this.method.toLowerCase() !== 'ws') {
			return this._handleHttp(req, res, next);
		} else {
			return this._handleWS(req);
		}
	}

	isInUrl(name) {
		return this.url.indexOf(':' + name) != -1;
	}

	toJson() {
		const json = {
			name: this.name,
			method: this.method,
			url: this.url
			// base: this.base,
		} as IEndpoint;

		if (this.controller) {
			json.controller = this.controller;
			json.action = this.action;
			if (this.params.length || this.data.length) {
				json.params = [];
			}
			if (this.params.length) {
				this.params.map(param => json.params.push(param));
			}
			if (this.data.length) {
				this.data.map(param => json.params.push(param));
			}
		} else {
			json.query = {
				entity: this.query.entity.name,
				id: this.query.id
			};
		}
		if (this.permissions.length) {
			json.permissions = this.permissions;
		}
		return json;
	}

	private _getController(): Controller {
		const controller_prefix = this.fromAddon ? this.fromAddon.package + '/' : '';
		if ( ! Endpoint.controllers[controller_prefix + this.controller]) {
			Endpoint.controllers[controller_prefix + this.controller] = new Controller(this.app);
		}
		return Endpoint.controllers[controller_prefix + this.controller];
	}

	private _buildParams(params: Array<any>) {
		if ( ! params ) {
			return false;
		}
		this.params = params.map(param => param);
	}

	private _handleParams(req, params): {resolvedParams: any, errors: MateriaError[]} {
		const resolvedParams = Object.assign({}, req.query, req.body, req.params);
		const errors: MateriaError[] = [];
		if (params.length > 0) {
			for (const param of params) {
				const v = resolvedParams[param.name];
				if (v !== undefined) {
					if (param.type == 'text' || param.type == 'string') {
						resolvedParams[param.name] = v;
					} else if (v == 'null' || v == '') {
						resolvedParams[param.name] = null;
					} else if (param.type == 'date') {
						resolvedParams[param.name] = new Date(v);
					} else if (param.type == 'number') {
						resolvedParams[param.name] = parseInt(v, 10);
					} else if (param.type == 'float') {
						resolvedParams[param.name] = parseFloat(v);
					} else if (param.type == 'boolean') {
						resolvedParams[param.name] = ! ( ! v || typeof v == 'string' && v.toLowerCase() == 'false' );
					} else {
						resolvedParams[param.name] = v;
					}
				}
				if ( resolvedParams[param.name] == null && param.required) {
					const error = new MateriaError(`Missing required parameter: ${param.name}`);
					this.app.logger.log(` └── ${error.message}`);
					errors.push(error);
				}
			}
		}
		return { resolvedParams, errors };
	}

	private _handleHttp(req, res, next): Promise<any> {
		// tslint:disable-next-line:max-line-length
		this.app.logger.log(`${chalk.bold('(Endpoint)')} Handle ${this.app.api.getMethodColor(this.method.toUpperCase())} ${chalk.bold(req.url)}`);

		const params = this._handleParams(req, this.params);

		if (params.errors.length > 0) {
			return this.app.actions.handle('beforeEndpoint', {
				method: req.method,
				url: req.url
			}, Object.assign({}, req.query, req.body, req.params), false).then(() => {
				if (params.errors.length == 1) {
					return res.status(500).send({
						error: true,
						message: params.errors[0].message
					});
				}
				return res.status(500).send({
					error: true,
					messages: params.errors,
					multi: true
				});
			});
		} else {
			return this.app.actions.handle('beforeEndpoint', {
				method: req.method,
				url: req.url
			}, Object.assign({}, req.query, req.body, req.params), true).then(() => {
				this.app.logger.log(` └── Parameters: ${JSON.stringify(params.resolvedParams)}`);
				if (this.controller && this.action) {
					let obj;
					try {
						const instance = this._getController().instance();
						this.app.logger.log(` └── Execute: (Controller) ${chalk.bold(instance.constructor.name)}.${chalk.bold(this.action)}\n`);
						obj = instance[this.action](req, res, next);
					} catch (e) {
						function fn() {
							if ( ! res.headerSent ) {
								return res.status(500).json({
									error: true,
									message: e.message
								});
							}
						}
						return this.app.actions.handle('afterEndpoint', {
							method: req.method,
							url: req.url
						}, Object.assign({}, req.query, req.body, req.params), false)
							.then(() => fn())
							.catch(() => fn());
					}
					if (! res.headerSent && obj && obj.then && obj.catch
						&& typeof obj.then === 'function'
						&& typeof obj.catch === 'function') {
						return obj.then((data) => {
							return this.app.actions.handle('afterEndpoint', {
								method: req.method,
								url: req.url
							}, Object.assign({}, req.query, req.body, req.params, data), true).then(() => {
								res.status(200).send(data);
							});
						}).catch(err => res.status(500).send(err));
					} else if (res.headerSent) {
						return this.app.actions.handle('afterEndpoint', {
							method: req.method,
							url: req.url
						}, Object.assign({}, req.query, req.body, req.params), true);
					}
				} else {
					this.app.logger.log(` └── Execute: (Query) ${chalk.bold(this.query.entity.name)}.${chalk.bold(this.query.id)}\n`);

					// Get latest query version (Fix issue where query change is not immediately reflected in endpoint result)
					this.query = this.app.entities.get(this.entity.name).getQuery(this.query.id);

					return this.app.actions.handle('beforeEndpoint', {
						method: req.method,
						url: req.url
					}, Object.assign({}, req.query, req.body, req.params), true)
						.then(() =>
							this.query.run(params.resolvedParams)
						)
						.then(data => {
							return this.app.actions.handle('afterEndpoint', {
								method: req.method,
								url: req.url
							}, Object.assign({}, req.query, req.body, req.params, data), true)
								.then(() => {
									res.status(200).json(data);
								}).catch(() => {
									res.status(200).json(data);
								});
						})
						.catch(err => {
							return this.app.actions.handle('afterEndpoint', {
								method: req.method,
								url: req.url
							}, Object.assign({}, req.query, req.body, req.params), true)
								.then(() => {
									res.status(500).send(err);
								})
								.catch(() => {
									res.status(500).send(err);
								});
						});
				}
			});
		}
	}

	private _handleWS(wss): Promise<any> {
		if (this.controller && this.action) {
			try {
				const instance = this._getController().instance();
				this.app.logger.log(` └── Execute: (Controller) ${chalk.bold(instance.constructor.name)}.${chalk.bold(this.action)}\n`);
				instance[this.action](wss);
			} catch (e) {
			}
		}
		return Promise.resolve();
	}
}
