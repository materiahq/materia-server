import { App } from '../../lib';
import { IEndpoint } from '@materia/interfaces';

import * as path from 'path';
import * as fs from 'fs';

import { EndpointsLib } from '../lib/endpoints';
import { WebsocketInstance } from '../../lib/websocket';

export class EndpointsController {
	constructor(private app: App, websocket: WebsocketInstance) { }

	getEndpoints(req, res) {
		const endpoints: IEndpoint[] = this.app.api.findAll().map(api =>
			Object.assign({}, api.toJson(), {
				fromAddon: api.fromAddon
					? {
						name: api.fromAddon.name,
						logo: api.fromAddon.logo,
						package: api.fromAddon.package,
						path: api.fromAddon.path
					}
					: {},
				params: api.getAllParams(),
				data: api.getAllData()
			})
		);
		return res.status(200).send(endpoints);
	}

	getControllers(req, res) {
		const controllers = this.app.api.getControllers();
		return res.status(200).send(controllers);
	}

	loadController(req, res) {
		let controllerName = req.params.name;
		if (req.params[0]) {
			controllerName += req.params[0];
		}
		try {
			let endpointPath = path.join(this.app.path, 'server', 'controllers');
			const fromAddon = controllerName.split('@materia').length > 1;
			if (fromAddon) {
				const stringArray = controllerName.split('/');
				let addonName = '';

				stringArray.forEach((value, i) => {
					if (i == 0) {
						addonName += value;
					} else if (i < stringArray.length - 1) {
						addonName += '/' + value;
					}
				});

				controllerName = stringArray[stringArray.length - 1];
				endpointPath = path.join(
					this.app.path,
					'node_modules',
					addonName,
					'server',
					'controllers'
				);
			}
			const code = fs
				.readFileSync(
					path.join(endpointPath, controllerName + '.ctrl.js'),
					'utf-8'
				)
				.toString();
			res.status(200).send(code);
		} catch (err) {
			res.status(500).send(err);
		}
	}

	add(req, res) {
		const newEndpoint = req.body.endpoint;
		if (newEndpoint.controller && newEndpoint.action) {
			this.createCode(req, res);
		} else if (newEndpoint.query) {
			this.createQuery(req, res);
		}
	}

	createCode(req, res) {
		const endpoint = req.body.endpoint;
		const options = req.body.options;
		if (endpoint.fromAddon && endpoint.fromAddon.package) {
			endpoint.fromAddon = this.app.addons.get(endpoint.fromAddon.package);
		}
		const controller = endpoint.fromAddon
			? endpoint.controller
				.split('/')
			[endpoint.controller.split('/').length - 1].replace(
				/(\.ctrl)?\.js$/,
				''
			)
			: endpoint.controller.replace(/(\.ctrl)?\.js$/, '');
		const basePath = endpoint.fromAddon
			? endpoint.fromAddon.path
			: this.app.path;
		const fullpath = path.join(
			basePath,
			'server',
			'controllers',
			controller + '.ctrl.js'
		);
		let promise = Promise.resolve();
		if (req.body.code) {
			promise = promise.then(() => this.app.saveFile(fullpath, req.body.code, { mkdir: true }));
		}
		promise.then(() => {
			const newEndpoint: any = {
				method: endpoint.method,
				url: endpoint.url,
				controller: controller,
				action: endpoint.action,
				params: endpoint.params,
				permissions: endpoint.permissions
			};
			if (endpoint.fromAddon) {
				newEndpoint.fromAddon = endpoint.fromAddon;
			}
			this.app.api.add(newEndpoint, options);
			res.status(201).json({
				endpoints: EndpointsLib.list(this.app),
				newSelectedId: endpoint.method + endpoint.url,
				controllers: this.app.api.getControllers()
			});
		}).catch(err => res.status(500).send(err.message));
	}

	createQuery(req, res) {
		const options = req.body.options;
		const endpoint = req.body.endpoint;
		this.app.watcher.disable();
		const newEndpoint: any = {
			method: endpoint.method,
			url: endpoint.url,
			params: endpoint.params,
			permissions: endpoint.permissions,
			query: endpoint.query
		};
		if (endpoint.fromAddon && endpoint.fromAddon.package) {
			newEndpoint.fromAddon = this.app.addons.get(endpoint.fromAddon.package);
		}
		this.app.api.add(newEndpoint, options);
		this.app.watcher.enable();
		res.status(201).json({
			endpoints: EndpointsLib.list(this.app),
			newSelectedId: endpoint.method + endpoint.url,
			controllers: this.app.api.getControllers()
		});
	}

	update(req, res) {
		const newEndpoint = req.body.newEndpoint;
		if (newEndpoint.controller && newEndpoint.action) {
			this.updateCode(req, res);
		} else if (newEndpoint.query) {
			this.updateQuery(req, res);
		}
	}

	updateCode(req, res) {
		const options = req.options;
		const newEndpoint = req.body.newEndpoint;
		const oldEndpointId = req.body.oldEndpointId;
		const [method, endpoint] = oldEndpointId;
		const controller = newEndpoint.controller.replace(
			/(\.ctrl)?\.js$/,
			''
		);
		const basePath = this.app.path;
		const fullpath = path.join(
			basePath,
			'server',
			'controllers',
			controller + '.ctrl.js'
		);
		this.app.watcher.disable();
		let promise = Promise.resolve();
		if (req.body.code) {
			promise = promise.then(() => this.app.saveFile(fullpath, req.body.code));
		}
		promise.then(() => {
			let params;
			if (newEndpoint.params) {
				params = EndpointsLib.cleanParams(newEndpoint.params);
			}
			this.app.api.remove(method, endpoint);
			const payload: any = {
				method: newEndpoint.method,
				url: newEndpoint.url,
				controller: controller,
				action: newEndpoint.action,
				params: params ? params : [],
				permissions: newEndpoint.permissions
			};
			if (newEndpoint.fromAddon && newEndpoint.fromAddon.package) {
				payload.fromAddon = this.app.addons.get(newEndpoint.fromAddon.package);
			}
			this.app.api.add(payload, options);

			EndpointsLib.list(this.app).find(e => e.method + e.url == newEndpoint.method + newEndpoint.url);
			this.app.watcher.enable();
			res.status(200).json({
				endpoints: EndpointsLib.list(this.app),
				newSelectedId:
					newEndpoint.method +
					newEndpoint.url,
				controllers: this.app.api.getControllers()
			});
		}).catch(err => {
			this.app.watcher.enable();
			res.status(500).json(err.message);
		});

	}

	updateQuery(req, res) {
		const options = req.options;
		const newEndpoint = req.body.newEndpoint;
		const oldEndpointId = req.body.oldEndpointId;
		this.app.watcher.disable();
		this.app.api.remove(oldEndpointId[0], oldEndpointId[1]);
		if (
			newEndpoint.params &&
			newEndpoint.params.length
		) {
			newEndpoint.params = EndpointsLib.cleanParams(
				newEndpoint.params
			);
		}
		if (!newEndpoint.permissions) {
			newEndpoint.permissions = [];
		}
		const payload: any = {
			method: newEndpoint.method,
			url: newEndpoint.url,
			params: newEndpoint.params
				? newEndpoint.params
				: [],
			permissions: newEndpoint.permissions,
			query: newEndpoint.query
		};
		if (newEndpoint.fromAddon && newEndpoint.fromAddon.package) {
			payload.fromAddon = this.app.addons.get(newEndpoint.fromAddon.package);
		}
		this.app.api.add(payload, options);
		this.app.watcher.enable();
		res.status(200).json({
			endpoints: EndpointsLib.list(this.app),
			newSelectedId:
				newEndpoint.method + newEndpoint.url,
			controllers: this.app.api.getControllers()
		});
	}

	remove(req, res) {
		const id = Buffer.from(req.params.id, 'base64').toString();
		const [method, ...parsedUrl] = id.split('/');
		let url = '';
		parsedUrl.forEach((t) => {
			url += `/${t}`;
		});
		this.app.watcher.disable();
		this.app.api.remove(method, url, { apply: true });
		this.app.watcher.enable();
		return res.status(200).send();
	}

	generate(req, res) {
		const entity = req.body;
		if ( ! entity.endpointsGenerated) {
			return null;
		}
		this.app.watcher.disable();
		EndpointsLib.generate(this.app, entity, 'get', 'list');
		EndpointsLib.generate(this.app, entity, 'get', 'get');
		EndpointsLib.generate(this.app, entity, 'post', 'create');
		EndpointsLib.generate(this.app, entity, 'put', 'update');
		EndpointsLib.generate(this.app, entity, 'delete', 'delete');

		this.app.watcher.enable();
		res.status(200).json({ endpoints: EndpointsLib.list(this.app) });
	}
}