'use strict';

var path = require('path')
var fs = require('fs')

class Endpoint {

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
	constructor(app, endpointConfig) {
		this.app = app
		this.history = app.history
		this.method = (endpointConfig.method && endpointConfig.method.toLowerCase()) || 'get'

		//this.name = endpointConfig.name
		//this.desc = endpointConfig.desc
		this.url = endpointConfig.url

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
			//try {
				if (require.cache[require.resolve(path.join(this.app.path, 'endpoints', this.file))]) {
					delete require.cache[require.resolve(path.join(this.app.path, 'endpoints', this.file))];
				}
				this.query = require(path.join(this.app.path, 'endpoints', this.file))
				this.queryStr = fs.readFileSync(path.join(this.app.path, 'endpoints', this.file + '.' + this.ext));
			//}
			//catch(e) {
			//	let err = new Error('Could not load endpoint ' + this.file)
			//	err.originalError = e
			//	throw err
			//}
		}
		else {
			if (typeof endpointConfig.query.entity == 'string') {
				this.entity = this.app.entities.get(endpointConfig.query.entity)
			}
			else {
				this.entity = this.app.entities.get(endpointConfig.query.entity.name)
			}

			this.query = this.entity.getQuery(endpointConfig.query.id)

			if ( ! this.query) {
				throw new Error('Could not find query "' + endpointConfig.query.id + '" of entity ' + this.entity.name)
			}

			if (this.method == 'post' || this.method == 'put' || this.method == 'patch') {
				for (let param of this.query.params) {
					this.data.push(param)
				}

				let re = /\:([a-zA-Z_][a-zA-Z0-9_-]*)/g
				let matchParam
				let idsToSplice = []
				while(matchParam = re.exec(this.url)) {
					for (let i in this.data) {
						if (this.data[i].name == matchParam[1]) {
							idsToSplice.push(i)
							this.params.push(this.data[i])
						}
					}
				}
				idsToSplice.forEach((id) => {
					this.data.splice(id, 1)
				})
				//console.log('in constructor endpoint:', this.params, this.data)
			}
			else {
				for (let param of this.query.params) {
					this.params.push(param)
				}
			}
		}
		//this.queryType = endpointConfig.queryType || 'findAll'
		//this.query = new Query[this.queryType](this, endpointConfig.query)

		//TODO: handle permission
		//this.permission = endpointConfig.permissions
	}

	getParam(name) {
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
		return this.getmergedParams(true)
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

	handle(req, res) {
		if ( ! this.entity && typeof this.query == 'function') {
			//TODO: Handle required params

			try {
				let obj = this.query(req, this.app)

				if (obj && obj.then && obj.catch
					&& typeof obj.then === 'function'
					&& typeof obj.catch === 'function') {
					obj.then((data) => {
						res.status(200).send(data)
					}).catch((e) => {
						console.log('reject promise', e)
						res.status(e.statusCode || 500).send(e)
					})
				}
				else {
					res.status(200).send(obj)
				}
			}
			catch (e) {
				console.log('catch error', e.toString());
				res.status(500).send({
					error: true,
					message: e.toString()
				})
			}
			return false;
		}

		//console.log '\n---\nHandle ' + @method.toUpperCase() + ' ' + @url, @params, @data
		//console.log 'Resolving parameters...'

		/*
		handle permissions
		asyncSeries(this.permissions, (permission, callback) => {
			permission.isAuthorized(req, res, () => {
				callback()
			})
		}, () => {
			//next
		})
		*/
		let resolvedParams = { params: {}, data: {} }
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
		}).catch((e) => {
			res.status(500).json({ error: true, message: e.message })
		})

		//res.status(501).json({ error: 'not implemented' }) //TODO: check good error code for database error
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
			url: this.url,
			//base: this.base,
		}
		if (this.file) {
			res.file = this.file
			res.ext = this.ext
		}
		else {
			res.query = {
				entity: this.query.entity.name,
				id: this.query.id
			}
		}
		if (this.params.length && ! this.query)
			res.params = this.params
		if (this.data.length && ! this.query)
			res.data = this.data
		if (this.permissions.length)
			res.permissions = this.permissions
		return res
	}
}

module.exports = Endpoint
