'use strict';

class Query {
	constructor(entity, id, params) {
		this.entity = entity
		this.history = entity.app.history
		this.id = id
		this.params = params
		if ( ! this.params ) {
			this.params = []
		}
	}

	refresh() {
	}

	updateOption(name, value, options) {
		return Promise.reject(new Error('not implemented yet'))
	}

	hasParameters() {
		return this.params.length > 0
	}

	getAllParams() {
		return this.params
	}

	getParam(name) {
		for (let param of this.params) {
			if (param.name == name)
				return param
		}
		return false
	}

	hasRequiredParameters() {
		for (let param of this.params) {
			if (param.required) {
				return true
			}
		}
		return false
	}

	resolveParams(params) {
		let res = {}

		for (let field in this.values) {
			try {
				res[field] = Query.resolveParam({ name: field, value: this.values[field] }, params)
			} catch (e) {
				if (this.getParam(field).required)
					throw e
			}
		}

		for (let field of this.params) {
			if ( ! this.values[field.name]) {
				try {
					res[field.name] = Query.resolveParam({ name: field.name, value: "=" }, params)
				} catch(e) {
					if (field.required)
						throw e
				}
			}
		}

		return res
	}

	static resolveParam(field, params) {
		if (field.value.substr(0, 1) == '=') {

			let paramName = field.name
			if (field.value.length > 1) {
				paramName = field.value.substr(1)
			}

			if (params.params && params.params[paramName] !== undefined) {
				return params.params[paramName]
			}
			if (params.data && params.data[paramName] !== undefined) {
				return params.data[paramName]
			}
			if (params[paramName] !== undefined) {
				return params[paramName]
			}
			throw new Error("param not found " + paramName)
		}

		if (field.value.substr(0, 1) == '%') {
			let paramName = field.name
			if (field.value.length > 1)
				paramName = field.value.substr(1)

			if (params.headers)
				return params.headers[paramName];

			throw new Error("header not found " + paramName)
		}

		//if field.substr(0, 1) == '$'
		// TODO: need to handle computation with $now
		//	if field == '$now'
		//		return new Date()
		return field.value
	}
}

module.exports = Query
