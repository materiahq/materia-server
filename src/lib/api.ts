import * as fs from 'fs'
import * as path from 'path'

import * as express from 'express'

import { Endpoint } from './api/endpoint'
import { Permissions } from './api/permissions'

import App, { AppMode, IApplyOptions } from './app'
import MateriaError from './error'

import { IAddon } from './addons'

/**
 * @class Api
 * @classdesc
 * This class is used to set the endpoints on the server
 * @property {Permissions} permissions - The access to the permission filters
 */
export default class Api {
	endpoints: Endpoint[]
	permissions: any
	router: express.Router

	constructor(private app: App) {
		this.endpoints = []
		this.permissions = new Permissions(app)
	}

	/**
	Check if an endpoint is registered
	@param {object} - Endpoint's description. must contain at leat `method` and `url`
	@returns {boolean}
	*/
	exists(endpoint):boolean {
		return !! this.get(endpoint.method, endpoint.url)
	}

	/**
	Add an endpoint to the server. This will replace any registered endpoint matching the `url` and `method`.
	@param {object} - Endpoint's description
	@param {object} - Action's options
	*/
	add(endpoint, options:IApplyOptions) {
		options = options || {}

		if ( ! endpoint.controller && endpoint.query && endpoint.query.entity && this.app.database.disabled ) {
			throw new MateriaError('The database is disabled and this endpoint rely on it')
		}
		if (endpoint) {
			if (options.fromAddon) {
				endpoint.fromAddon = options.fromAddon
			}
			let obj = new Endpoint(this.app, endpoint)
			if (this.exists(endpoint)) {
				this.remove(endpoint.method, endpoint.url, options)
			}
			this.endpoints.push(obj)
			if (options.apply != false) {
				this.updateEndpoints()
			}
			if (options.save != false) {
				this.save(options)
			}
		}
	}

	/**
	Replace an endpoint at the `pos` index in the endpoints' array.
	@param {object} - Endpoint's description
	@param {integer} - Position in the array
	@param {object} - Action's options
	*/
	put(endpoint, pos, options:IApplyOptions) {
		options = options || {}
		this.endpoints[pos] = new Endpoint(this.app, endpoint)
		if (options.apply != false) {
			this.updateEndpoints()
		}
		if (options.save != false) {
			this.save(options)
		}
	}

	/**
	Remove a registered endpoint.
	@param {string} - HTTP method. `get`, `post`, `put` or `delete`
	@param {string} - HTTP url relative to the API base.
	@param {object} - Action's options
	*/
	remove(method, url, options:IApplyOptions) {
		options = options || {}
		this.endpoints.forEach((endpoint, i) => {
			if (endpoint.url == url && endpoint.method == method) {
				this.endpoints.splice(i, 1)
				if (options.apply != false) {
					this.updateEndpoints()
				}
				if (options.save != false) {
					let opts:IApplyOptions = Object.assign({}, options)
					opts.fromAddon = endpoint.fromAddon
					this.save(opts)
				}
				return
			}
		})
	}

	/**
	Get a registered endpoint.
	@param {string} - HTTP method. `get`, `post`, `put` or `delete`
	@param {string} - HTTP url relative to the API base.
	@returns {Endpoint}
	*/
	get(method, url) {
		return this.endpoints.find(endpoint => endpoint.url == url && endpoint.method == method)
	}

	/**
	Get all endpoints
	@returns {Array<Endpoint>}
	*/
	findAll() { return this.endpoints }

	load(addon?: IAddon):Promise<any> {
		let basePath = addon ? addon.path : this.app.path
		let opts: IApplyOptions = {
			save: false
		}
		if (addon) {
			opts.fromAddon = addon
		}
		this.permissions.load()
		let content
		try {
			content = fs.readFileSync(path.join(basePath, 'server', 'api.json'))
		}
		catch(e) {
			return Promise.resolve()
		}

		try {
			let endpoints = JSON.parse(content.toString())

			if (endpoints.length > 0) {
				if (addon) {
					this.app.logger.log(` │ └─┬ ${addon.package}`)
				}
				else {
					this.app.logger.log(` │ └─┬ Application`)
				}
			}

			endpoints.forEach((endpoint) => {
				try {
					this.app.logger.log(` │ │ └── ${endpoint.method.toUpperCase()} /api${endpoint.url}`)
					this.add(endpoint, opts)
				} catch (e) {
					this.app.logger.warn(' │ │     Skipped endpoint ' + endpoint.method + ' ' + endpoint.url)
					this.app.logger.warn(' │ │     due to error ' + e.message, e.stack)
				}
			})
		} catch (e) {
			if (e.code != 'ENOENT')
				this.app.logger.error(' │ │ └── Error loading endpoints', e.stack)
			else
				return Promise.reject(e)
		}
		return Promise.resolve()
	}

	updateEndpoints() {
		this.router = express.Router()
		this.endpoints.forEach((endpoint) => {
			let route = this.router[endpoint.method.toLowerCase()]
			route.call(this.router, endpoint.url, this.permissions.check(endpoint.permissions), (req, res, next) => {
				endpoint.handle(req, res, next).catch((e) => {
					if (e instanceof Error) {
						e = {
							error: true,
							message: e.message
						}
					}
					if (this.app.mode != AppMode.PRODUCTION) {
						e.stack = e.stack
					}
					res.status(e.statusCode || 500).send(e)
				})
			})
		})
	}

	resetControllers() {
		Endpoint.resetControllers()
	}

	registerEndpoints() {
		let appServer = this.app.server.expressApp

		this.updateEndpoints()
		appServer.use('/api', (req, res, next) => {
			return this.router(req, res, next)
		})
	}

	/**
	Get the endpoints array in the `api.json` format
	@returns {Array<object>}
	*/
	toJson(opts?:IApplyOptions) {
		let res = []
		this.endpoints.forEach((endpoint) => {
			if ( ! opts || opts.fromAddon == endpoint.fromAddon) {
				res.push(endpoint.toJson())
			}
		})
		return res
	}

	save(opts?:IApplyOptions) {
		if (opts && opts.beforeSave) {
			opts.beforeSave(path.join('server', 'api.json'))
		}
		if ( ! opts.fromAddon) {
			let basePath = (opts && opts.fromAddon) ? opts.fromAddon.path : this.app.path
			fs.writeFileSync(path.join(basePath, 'server', 'api.json'), JSON.stringify(this.toJson(opts), null, '\t'))
		}
		if (opts && opts.afterSave) {
			opts.afterSave()
		}
	}

	getControllers() {
		return Object.keys(Endpoint.controllers)
	}
}
