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

	addParam(value, options) {
		options = options || {}
		let name = value.name

		if (this.getParam(name))
			return Promise.reject(new Error('A param of this name already exists'))

		if (options.history != false) {
			this.history.push({
				type: this.history.DiffType.ADD_QUERY_PARAM,
				table: this.entity.name,
				id: this.id,
				value: value
			},{
				type: this.history.DiffType.DELETE_QUERY_PARAM,
				table: this.entity.name,
				id: this.id,
				value: name
			})
		}

		this.params.push(value)
		this.refresh()

		if (options.save != false)
			this.entity.save()

		return Promise.resolve()
	}

	delParam(name, options) {
		options = options || {}

		let param = this.getParam(name)
		if (param)
			return Promise.reject(new Error('Could not find param of this name'))

		if (options.history != false) {
			this.history.push({
				type: this.history.DiffType.DELETE_QUERY_PARAM,
				table: this.entity.name,
				id: this.id,
				value: name,
			},{
				type: this.history.DiffType.ADD_QUERY_PARAM,
				table: this.entity.name,
				id: this.id,
				value: param
			})
		}

		for (let i in this.params)
			if (this.params[i].name == name)
				delete this.params[i]
		this.refresh()

		if (options.save != false)
			this.entity.save()

		return Promise.resolve()
	}

	updateValue(name, value, options) {
		options = options || {}

		this.values = this.values || {}

		if (options.history != false) {
			this.history.push({
				type: this.history.DiffType.UPDATE_QUERY_VALUE,
				table: this.entity.name,
				id: this.id,
				value: {
					name: name,
					value: value
				}
			},{
				type: this.history.DiffType.UPDATE_QUERY_VALUE,
				table: this.entity.name,
				id: this.id,
				value: {
					name: name,
					value: this.values[name]
				}
			})
		}

		this.values[name] = value
		this.refresh()

		if (options.save != false)
			this.entity.save()

		return Promise.resolve()
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
				//console.log 'next'
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
