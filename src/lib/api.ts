import * as fs from 'fs'
import * as path from 'path'

import * as express from 'express'

const Endpoint = require('./api/endpoint')
const Permissions = require('./api/permissions')

import MateriaError, { ErrorType } from './error'

import App from './app'

/**
 * @class Api
 * @classdesc
 * This class is used to set the endpoints on the server
 * @property {Permissions} permissions - The access to the permission filters
 */
export default class Api {
	endpoints: any[]
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
	exists(endpoint) {
		let find = false
		this.endpoints.forEach((e) => {
			if (endpoint.method == e.method && endpoint.url == e.url) {
				find = true
			}
		})
		return find
	}

	/**
	Add an endpoint to the server. This will replace any registered endpoint matching the `url` and `method`.
	@param {object} - Endpoint's description
	@param {object} - Action's options
	*/
	add(endpoint, options) {
		options = options || {}

		if ( ! endpoint.file && typeof endpoint.query == 'Object' && endpoint.query.entity && this.app.database.disabled ) {
			throw new Error('The database is disabled and this endpoint rely on it')
		}
		if (endpoint) {
			if (this.exists(endpoint)) {
				this.remove(endpoint.method, endpoint.url, options)
			}
			if (options.fromAddon) {
				endpoint.fromAddon = options.fromAddon
			}
			this.endpoints.push(new Endpoint(this.app, endpoint))
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
	put(endpoint, pos, options) {
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
	remove(method, url, options) {
		options = options || {}
		this.endpoints.forEach((endpoint, i) => {
			if (endpoint.url == url && endpoint.method == method) {
				this.endpoints.splice(i, 1)
				if (options.apply != false) {
					this.updateEndpoints()
				}
				if (options.save != false) {
					this.save(options)
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

	private _loadJson(basepath:string):Promise<any> {
		return new Promise((resolve, reject) => {
			fs.exists(path.join(basepath, 'api.json'), (exists) => {
				//File api.json optional
				if ( ! exists ) { return resolve([]) }
				fs.readFile(path.join(basepath, 'api.json'), 'utf8', (err, content) => {
					if (err) {
						//TODO: Change this in warning
						this.app.logger.error("Error while trying to read api.json file. It can be a permission issue. Endpoints has been skipped", err);
						return resolve([])
					}

					let endpoints;
					try {
						endpoints = JSON.parse(content)
						return resolve(endpoints)
					}
					catch (e) {
						return reject(e)
					}
				})
			})
		})
	}

	_loadFromPath(basepath, opts): Promise<void> {
		this.permissions.clear()
		return new Promise((resolve, reject) => {
			this._loadJson(basepath).then(endpoints => {
				let errors = []
				endpoints.forEach((endpoint) => {
					try {
						this.add(endpoint, opts)
					} catch (e) {
						let error = new MateriaError(`Skipped endpoint ${endpoint.method} ${endpoint.url}
						due to error ${e.message}
						${e.stack}`, {
							type: ErrorType.ENDPOINT
						})
						errors.push(error)
					}
				})
				if ( errors.length ) {
					return reject(errors)
				}
				return resolve()
			}).catch(e => {
				let error = new MateriaError('The JSON in the file api.json is malformed.', {
					type: ErrorType.API
				});
				this.app.logger.error(error)
				return reject(error)
			})
		})
	}

	load():Promise<void> {
		this.endpoints = []
		return this._loadFromPath(this.app.path, {
			save: false
		})
	}

	loadFromAddon(addon):Promise<void> {
		return this._loadFromPath(path.join(this.app.path, 'addons', addon), {
			save: false,
			fromAddon: addon
		})
	}

	updateEndpoints() {
		this.router = express.Router()
		this.endpoints.forEach((endpoint) => {
			let route = this.router[endpoint.method.toLowerCase()]
			route.call(this.router, endpoint.url, this.permissions.check(endpoint.permissions), (req, res) => {
				endpoint.handle(req, res)
			})
		})
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
	toJson() {
		let res = []
		this.endpoints.forEach((endpoint) => {
			res.push(endpoint.toJson())
		})
		return res
	}

	save(opts) {
		if (opts && opts.beforeSave) {
			opts.beforeSave('api.json')
		}
		fs.writeFileSync(path.join(this.app.path, 'api.json'), JSON.stringify(this.toJson(), null, '\t'))
		if (opts && opts.afterSave) {
			opts.afterSave()
		}
	}
}
