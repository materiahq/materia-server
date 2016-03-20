'use strict';
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

		this.base = endpointConfig.base

		this.params = []
		this.data = []
		this.permissions = endpointConfig.permissions || []

		if (typeof endpointConfig.query == 'function') {
			this.params = endpointConfig.params || []
			this.data = endpointConfig.data || []
			this.query = endpointConfig.query
		}
		else {
			if (typeof endpointConfig.query.entity == 'string') {
				this.entity = this.app.entities.get(endpointConfig.query.entity)
			}
			else {
				this.entity = this.app.entities.get(endpointConfig.query.entity.name)
			}

			this.query = this.entity.getQuery(endpointConfig.query.id)

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

	addParam(value, options) {
		options = options || {}
		let name = value.name

		if (this.getParam(name))
			return Promise.reject(new Error('A param of this name already exists'))

		if (options.history != false) {
			this.history.push({
				type: this.history.DiffType.ADD_API_PARAM,
				url: this.url,
				method: this.method,
				value: value
			},{
				type: this.history.DiffType.DELETE_API_PARAM,
				url: this.url,
				method: this.method,
				value: name,
			})
		}

		this.params.push(value)

		if (options.save != false)
			this.app.api.save()

		return Promise.resolve()
	}

	delParam(name, options) {
		options = options || {}

		let param = this.getParam(name)
		if (param)
			return Promise.reject(new Error('Could not find param of this name'))

		if (options.history != false) {
			this.history.push({
				type: this.history.DiffType.DELETE_API_PARAM,
				url: this.url,
				method: this.method,
				value: name,
			},{
				type: this.history.DiffType.ADD_API_PARAM,
				url: this.url,
				method: this.method,
				value: param
			})
		}

		for (let i in this.params) {
			if (this.params[i].name == name) {
				delete this.params[i]
			}
		}
		if (options.save != false) {
			this.app.api.save()
		}

		return Promise.resolve()
	}

	addData(value, options) {
		options = options || {}
		let name = value.name

		if (this.getData(name))
			return Promise.reject(new Error('A data of this name already exists'))

		if (options.history != false) {
			this.history.push({
				type: this.history.DiffType.ADD_API_DATA,
				url: this.url,
				method: this.method,
				value: value
			},{
				type: this.history.DiffType.DELETE_API_DATA,
				url: this.url,
				method: this.method,
				value: name,
			})
		}

		this.data.push(value)

		if (options.save != false)
			this.app.api.save()

		return Promise.resolve()
	}

	delData(name, options) {
		options = options || {}

		let param = this.getData(name)
		if (param)
			return Promise.reject(new Error('Could not find data of this name'))

		if (options.history != false) {
			this.history.push({
				type: this.history.DiffType.DELETE_API_DATA,
				url: this.url,
				method: this.method,
				value: name,
			},{
				type: this.history.DiffType.ADD_API_DATA,
				url: this.url,
				method: this.method,
				value: {
					name: name,
					value: param
				}
			})
		}

		for (let i in this.data)
			if (this.data[i].name == name)
				delete this.data[i]

		if (options.save != false)
			this.app.api.save()

		return Promise.resolve()
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
			return this.query(req, res)
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
				if (req.body[d.name]) {
					v = req.body[d.name]
				}
				if ( ! v && d.required && this.method.toLowerCase() == 'post') {
					return res.status(500).json({ error: true, message: 'Missing required data:' + d.name })
				}
				if (v) {
					resolvedParams.data[d.name] = v
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
			res.status(500).json(e.message)
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
			base: this.base,
			query: {
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
