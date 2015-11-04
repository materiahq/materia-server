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
		this.method = endpointConfig.method || 'GET'

		this.name = endpointConfig.name
		this.desc = endpointConfig.desc
		this.url = endpointConfig.url

		this.base = endpointConfig.base

		this.params = endpointConfig.params || []
		this.data = endpointConfig.data || []

		if (typeof endpointConfig.query == 'function') {
			this.query = endpointConfig.query
		}
		else {
			this.entity = this.app.entities.get(endpointConfig.query.entity)
			this.query = this.entity.getQuery(endpointConfig.query.id)
		}
		//this.queryType = endpointConfig.queryType || 'findAll'
		//this.query = new Query[this.queryType](this, endpointConfig.query)

		//TODO: handle permission
		//this.permission = endpointConfig.permissions
	}

	/* Retrieve a param by its name */
	getParam(name) {
		let result = false
		for (param of this.params) {
			if (param.name == name) {
				result = param
			}
		}
		return result
	}

	/* Add a param
	** param is a string - name of the param
	** type is a string - type of the param
	*/
	addParam(param, type) {
		this.params.push({
			param: param,
			type: type
		})
	}

	getAllParams(onlyRequired) {
		let res = []
		this.params.forEach((param) => {
			if (param.required || ! onlyRequired) {
				res.push(param)
			}
		})
		this.data.forEach((data) => {
			if (data.required || ! onlyRequired) {
				res.push(data)
			}
		})
		return res
	}
	getRequiredParams() {
		return this.getAllParams(true)
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
				} else if (param.required) {
					//console.log v
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
			for (d in this.data) {
				let v = null
				if (req.body[d.name]) {
					v = req.body[d.name]
				}
				if ( ! v && d.required && this.method.toLowerCase() == 'post') {
					return res.status(500).json({ error: true, message: 'Missing required data:' + data.name })
				}
				if (v) {
					resolvedParams.data[d.name] = v
				}
			}
		}
		console.log('Execute query', resolvedParams)
		//exec query and return result

		this.query.run(resolvedParams).then((data) => {
			res.status(200).json(data)
		}).error((e) => {
			res.status(500).json(e)
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
			params: this.params,
			data: this.data,
			//queryType: this.queryType,
			//query: this.query.toJson()
		}
		return res
	}
}

module.exports = Endpoint
