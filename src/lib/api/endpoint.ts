import * as path from 'path'
import * as fs from 'fs'

import chalk from 'chalk'

import { App } from '../app'
import { MateriaError } from '../error'

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
	name?: string,
	method: string,
	url: string,
	controller?: string,
	action?: string,
	query?: {
		entity: any,
		id: any
	},
	params?: Array<any>,
	parent?: string,
	//data?: any[],
	permissions?: Array<string>,
	fromAddon?: IAddon
}

export class Controller {
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
			this.ctrlStr = fs.readFileSync(ctrlPath, 'utf-8').toString()
			delete this.ctrlInstance
		} catch(e) {
			let err = new MateriaError(`Could not load controller ${controller}: ${e}`) as any
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
	parent?: string

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
		this.parent = endpointConfig.parent
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
				throw new MateriaError(`cannot find method ${this.action} in controller ${this.controller}.ctrl.js`)
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

	static resetControllers():void {
		Endpoint.controllers = {}
	}

	private _getController():Controller {
		let controller_prefix = this.fromAddon ? this.fromAddon.package + "/" : ""
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

	getAllData(onlyRequired?: boolean) {
		let res = []
		this.data.forEach((data) => {
			if (data.required && onlyRequired || ! onlyRequired) {
				res.push(data)
			}
		})
		return res;
	}


	getAllParams(onlyRequired?: boolean) {
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

	private handleParams(req, params): {resolvedParams: any, errors: MateriaError[]} {
		let resolvedParams = Object.assign({}, req.query, req.body, req.params)
		let errors: MateriaError[] = []
		if (params.length > 0) {
			for (let param of params) {
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
					let error = new MateriaError(`Missing required parameter: ${param.name}`)
					this.app.logger.log(` └── ${error.message}`)
					errors.push(error)
				}
			}
		}
		return { resolvedParams, errors }
	}

	handle(req, res, next):Promise<any> {
		this.app.logger.log(`${chalk.bold('(Endpoint)')} Handle ${this.app.api.getMethodColor(req.method.toUpperCase())} ${chalk.bold(req.url)}`)

		let params = this.handleParams(req, this.params)

		if (params.errors.length > 0) {
			if (params.errors.length == 1) {
				return  res.status(500).send(params.errors[0])
			}
			return res.status(500).send(params.errors)
		}
		this.app.logger.log(` └── Parameters: ${JSON.stringify(params.resolvedParams)}`)
		if (this.controller && this.action) {
			let obj
			try {
				let instance = this._getController().instance()
				this.app.logger.log(` └── Execute: (Controller) ${chalk.bold(instance.constructor.name)}.${chalk.bold(this.action)}\n`)
				obj = instance[this.action](req, res, next)
			} catch (e) {
				return  res.status(500).json({
					error: true,
					message: e.message
				});
			}
			if (obj && obj.then && obj.catch
				&& typeof obj.then === 'function'
				&& typeof obj.catch === 'function') {
				return obj.then((data) =>
					res.status(200).send(data)
				).catch(err => res.status(500).send(err));
			}
		}
		else {
			this.app.logger.log(` └── Execute: (Query) ${chalk.bold(this.query.entity.name)}.${chalk.bold(this.query.id)}\n`)
			this.query = this.app.entities.get(this.entity.name).getQuery(this.query.id) // Get latest query version (Fix issue where query change is not immediately reflected in endpoint result)
			return this.query.run(params.resolvedParams).then(data => {
				res.status(200).json(data)
			}).catch(err => res.status(500).send(err));
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
