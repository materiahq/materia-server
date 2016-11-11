'use strict';

import * as path from 'path'
import * as fs from 'fs'

import App from '../app'

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
	file?: string,
	ext?: string,
	query?: {
		entity: any,
		id: any
	},
	params?: Array<any>,
	//data?: any[],
	permissions?: Array<string>,
	fromAddon: string
}

export default class Endpoint {
	name: string
	method: string
	url: string
	fromAddon: string|boolean

	params: Array<IParam>
	data: Array<IParam>

	permissions: Array<string>

	file: string
	ext: string

	//TODO: differentiate query from javascript endpoint and query from query endpoint
	//query: (req, app, res) => Promise<any>
	query: any
	queryStr: string

	entity: any

	constructor(private app:App, endpointConfig: IEndpoint) {
		//this.history = app.history
		this.method = (endpointConfig.method && endpointConfig.method.toLowerCase()) || 'get'

		//this.name = endpointConfig.name
		//this.desc = endpointConfig.desc
		this.url = endpointConfig.url
		this.fromAddon = endpointConfig.fromAddon || false
		//this.base = endpointConfig.base

		this.params = []
		this.data = []
		this.permissions = endpointConfig.permissions || []

		/*if (typeof endpointConfig.query == 'function') {
			this.params = endpointConfig.params || []
			this.data = endpointConfig.data || []
			this.query = endpointConfig.query
		}*/

		if (endpointConfig.file) {
			this.file = endpointConfig.file
			this.ext = endpointConfig.ext || 'js'

			let basepath = this.app.path
			if ( this.fromAddon ) {
				basepath = path.join(this.app.path, 'addons', this.fromAddon)
			}

			if (require.cache[require.resolve(path.join(basepath, 'endpoints', this.file))]) {
				delete require.cache[require.resolve(path.join(basepath, 'endpoints', this.file))];
			}
			this.query = require(path.join(basepath, 'endpoints', this.file))
			this.queryStr = fs.readFileSync(path.join(basepath, 'endpoints', this.file + '.' + this.ext), 'utf-8');
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
				throw new Error('Could not find entity ' + entity_name)
			}

			this.query = this.entity.getQuery(endpointConfig.query.id)

			if ( ! this.query || this.query.error ) {
				throw new Error('Could not find query "' + endpointConfig.query.id + '" of entity ' + this.entity.name)
			}
			this._buildParams(this.query.params)
		}
		//this.queryType = endpointConfig.queryType || 'findAll'
		//this.query = new Query[this.queryType](this, endpointConfig.query)

		//TODO: handle permission
		//this.permission = endpointConfig.permissions
	}

	private _buildParams(params) {
		if ( ! params ) {
			return false
		}
		if (this.method == 'post' || this.method == 'put' || this.method == 'patch') {
			let re = /\:([a-zA-Z_][a-zA-Z0-9_-]*)/g,
				matchParam,
				idsToSplice = [];

			params.map(param => {
				this.data.push(param)
			})

			while(matchParam = re.exec(this.url)) {
				this.data.forEach((data, i) => {
					if (data.name == matchParam[1]) {
						idsToSplice.push(i)
						this.params.push(data)
					}
				})
			}
			idsToSplice.map(id => {
				this.data.splice(id, 1)
			})
		}
		else {
			params.map(param => {
				this.params.push(param)
			})
		}

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

	getMergedParams(onlyRequired) {
		let res = []
		this.params.forEach((param) => {
			if (param.required && onlyRequired || ! onlyRequired) {
				res.push(param)
			}
		})
		this.data.forEach((data) => {
			if (data.required && onlyRequired || ! onlyRequired) {
				res.push(data)
			}
		})
		return res;
	}

	getRequiredMergedParams() {
		return this.getMergedParams(true)
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

	handle(req, res):Promise<any> {
		//if endpoint type javascript
		return new Promise((resolve, reject) => {
			if ( ! this.entity && typeof this.query == 'function') {
				//TODO: Handle required params
				try {
					let obj = this.query(req, this.app, res)
					if (obj && obj.then && obj.catch
						&& typeof obj.then === 'function'
						&& typeof obj.catch === 'function') {
						obj.then((data) => {
							res.status(200).send(data)
							resolve(data)
						}).catch((e) => {
							if (e instanceof Error) {
								e = {
									error: true,
									message: e.message
								}
							}
							res.status(e.statusCode || 500).send(e)
							return reject(e)
						})
					}
					else {
						res.status(200).send(obj)
						return resolve(obj)
						//if (res.)
					}
				}
				catch (e) {
					return res.status(e.statusCode || 500).send({
						error: true,
						message: e.toString()
					})
				}
			}
			else {
				let resolvedParams = { params: {}, data: {}, headers: {}, session: {} }
				//console.log(this.params, this.data)
				if (this.params.length > 0) {
					for (let param of this.params) {
						let v = null
						//console.log req.params, req.params[param.name], req[param.name]
						if (req.params[param.name] != null) {
							v = req.params[param.name]
						} else if (req[param.name] != null) {
							v = req[param.name]
						} else if (req.query[param.name] != null) {
							v = req.query[param.name]
						} else if (param.required) {
							return res.status(500).json({
								error: true,
								message: 'Missing required parameter:' + param.name
							})
						}
						//handle typeof `v` (number -> parseInt(v), date -> new Date(v) ...)
						resolvedParams.params[param.name] = v
					}
				}
				if (this.data.length > 0) {
					for (let d of this.data) {
						let v = null
						if (req.body[d.name] !== null) {
							v = req.body[d.name]
						}
						if ( v === null && d.required && this.method.toLowerCase() == 'post') {
							return res.status(500).json({ error: true, message: 'Missing required data:' + d.name })
						}
						if (v !== null) {
							if (v == 'null' && d.type == 'date') {
								resolvedParams.data[d.name] = null
							}
							else {
								resolvedParams.data[d.name] = v
							}
						}
					}
				}
				resolvedParams.headers = req.headers;
				resolvedParams.session = req.session;
				//console.log('Execute query', resolvedParams)
				//exec query and return result

				this.query.run(resolvedParams).then((data) => {
					res.status(200).json(data)
					resolve(data)
				}).catch((e) => {
					let err = { error: true, message: e.message }
					res.status(500).json(err)
					reject(err)
				})
			}
		})
	}

	isInUrl(name) {
		if (this.url.indexOf(':' + name) != -1) {
			return true
		}
		return false
	}

	toJson() {
		let res = {
			name: this.name,
			method: this.method,
			url: this.url
			//base: this.base,
		} as IEndpoint

		if (this.file) {
			res.file = this.file
			res.ext = this.ext
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
		console.log(res, this.permissions)
		return res
	}
}

module.exports = Endpoint
