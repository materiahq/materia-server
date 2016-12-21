import * as path from 'path'
import * as fs from 'fs'

import App, { AppMode } from '../app'
import MateriaError from '../error'

import { IAddon } from '../addons'

// Not used yet
export enum Method {
	GET,
	POST,
	PUT,
	DELETE,
	PATCH
}

export interface IParam {
	name: string,
	required: boolean,
	type: string
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
export interface IEndpoint {
	name: string,
	method: string,
	url: string,
	controller?: string,
	action?: string,
	query?: {
		entity: any,
		id: any
	},
	params?: Array<any>,
	//data?: any[],
	permissions?: Array<string>,
	fromAddon?: IAddon
}

class Controller {
	private app: App
	ctrlClass: any
	ctrlStr: string
	ctrlInstance: any

	constructor(app:App) {
		this.app = app;
	}

	load(basePath:string, controller:string):void {
		let ctrlPath = require.resolve(path.join(basePath, 'server', 'controllers', controller + '.ctrl.js'))
		try {
			if (require.cache[ctrlPath]) {
				delete require.cache[ctrlPath]
			}
			this.ctrlClass = require(ctrlPath)
			this.ctrlStr = fs.readFileSync(ctrlPath, 'utf8').toString()
			delete this.ctrlInstance
		} catch(e) {
			let err = new MateriaError('Could not load controller ' + controller) as any
			err.originalError = e
			throw err
		}
	}

	instance():any {
		if ( ! this.ctrlInstance) {
			this.ctrlInstance = new this.ctrlClass(this.app)
		}
		return this.ctrlInstance
	}
}

export class Endpoint {
	name: string
	method: string
	url: string
	fromAddon?: IAddon

	params: Array<IParam>
	data: Array<IParam>

	permissions: Array<string>

	controller: string
	action: string

	query: any
	queryStr: string

	static controllers: {[name:string]: Controller} = {}

	entity: any

	constructor(private app:App, endpointConfig: IEndpoint) {
		this.method = (endpointConfig.method && endpointConfig.method.toLowerCase()) || 'get'

		//this.name = endpointConfig.name
		//this.desc = endpointConfig.desc
		this.url = endpointConfig.url
		this.fromAddon = endpointConfig.fromAddon

		this.params = []
		this.data = []
		this.permissions = endpointConfig.permissions || []

		/*if (typeof endpointConfig.query == 'function') {
			this.params = endpointConfig.params || []
			this.data = endpointConfig.data || []
			this.query = endpointConfig.query
		}*/

		if (endpointConfig.controller) {
			this.controller = endpointConfig.controller
			this.action = endpointConfig.action

			let basePath = this.fromAddon ? this.fromAddon.path : this.app.path

			let ctrl = this._getController()
			ctrl.load(basePath, this.controller)

			if ( ! ctrl.ctrlClass.prototype[this.action]) {
				throw new MateriaError(`cannot find method ${this.action} in controller ${this.controller}.js`)
			}
			this._buildParams(endpointConfig.params)
		}
		else {
			let entity_name
			if (typeof endpointConfig.query.entity == 'string') {
				entity_name = endpointConfig.query.entity
			}
			else {
				entity_name = endpointConfig.query.entity.name
			}

			this.entity = this.app.entities.get(entity_name)

			if ( ! this.entity) {
				throw new MateriaError('Could not find entity ' + entity_name)
			}

			this.query = this.entity.getQuery(endpointConfig.query.id)

			if ( ! this.query || this.query.error ) {
				throw new MateriaError('Could not find query "' + endpointConfig.query.id + '" of entity ' + this.entity.name)
			}
			this._buildParams(this.query.params)
		}
	}

	private _getController():Controller {
		let controller_prefix = this.fromAddon ? this.fromAddon.name + "/" : ""
		if ( ! Endpoint.controllers[controller_prefix + this.controller]) {
			Endpoint.controllers[controller_prefix + this.controller] = new Controller(this.app)
		}
		return Endpoint.controllers[controller_prefix + this.controller]
	}

	private _buildParams(params:Array<any>) {
		if ( ! params ) {
			return false
		}
		this.params = params.map(param => param)
	}

	getParam(name:string):any {
		for (let param of this.params) {
			if (param.name == name)
				return param
		}
		return false
	}

	getData(name) {
		for (let param of this.data) {
			if (param.name == name)
				return param
		}
	}

	getAllData(onlyRequired) {
		let res = []
		this.data.forEach((data) => {
			if (data.required && onlyRequired || ! onlyRequired) {
				res.push(data)
			}
		})
		return res;
	}


	getAllParams(onlyRequired) {
		let res = []
		this.params.forEach((param) => {
			if (param.required && onlyRequired || ! onlyRequired) {
				res.push(param)
			}
		})
		return res
	}
	getRequiredParams() {
		return this.getAllParams(true)
	}
	getRequiredData() {
		return this.getAllData(true)
	}

	handle(req, res, next):Promise<any> {
		let resolvedParams = Object.assign({}, req.query, req.body, req.params)
		if (this.params.length > 0) {
			for (let param of this.params) {
				let v = resolvedParams[param.name]
				if (v !== undefined) {
					if (param.type == 'text' || param.type == 'string') {
						resolvedParams[param.name] = v
					}
					else if (v == "null" || v == "") {
						resolvedParams[param.name] = null
					}
					else if (param.type == 'date') {
						resolvedParams[param.name] = new Date(v)
					}
					else if (param.type == 'number') {
						resolvedParams[param.name] = parseInt(v)
					}
					else if (param.type == 'float') {
						resolvedParams[param.name] = parseFloat(v)
					}
					else if (param.type == 'boolean') {
						resolvedParams[param.name] = ! ( ! v || typeof v == 'string' && v.toLowerCase() == 'false' )
					}
					else {
						resolvedParams[param.name] = v
					}
				}

				if ( resolvedParams[param.name] == null && param.required) {
					return Promise.reject(new MateriaError('Missing required parameter: ' + param.name))
				}
			}
		}

		if (this.controller && this.action) {
			let obj
			try {
				let instance = this._getController().instance()
				obj = instance[this.action](req, res, next)
			} catch (e) {
				return Promise.reject(e)
			}
			if (obj && obj.then && obj.catch
				&& typeof obj.then === 'function'
				&& typeof obj.catch === 'function') {
				return obj.then((data) => {
					res.status(200).send(data)
				})
			}
			return Promise.resolve()
		}
		else {
			return this.query.run(resolvedParams).then(data => {
				res.status(200).json(data)
			})
		}
	}

	isInUrl(name) {
		return this.url.indexOf(':' + name) != -1
	}

	toJson() {
		let res = {
			name: this.name,
			method: this.method,
			url: this.url
			//base: this.base,
		} as IEndpoint

		if (this.controller) {
			res.controller = this.controller
			res.action = this.action
			if (this.params.length || this.data.length) {
				res.params = []
			}
			if (this.params.length) {
				this.params.map(param => res.params.push(param))
			}
			if (this.data.length) {
				this.data.map(param => res.params.push(param))
			}
		}
		else {
			res.query = {
				entity: this.query.entity.name,
				id: this.query.id
			}
		}
		if (this.permissions.length) {
			res.permissions = this.permissions
		}
		return res
	}
}
