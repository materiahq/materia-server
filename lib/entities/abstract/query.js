'use strict';

class Query {
	constructor(entity, id, params) {
		this.entity = entity
		this.id = id
		this.params = params
		if ( ! this.params ) {
			this.params = []
		}
	}

	hasParameters() {
		return this.params.length > 0
	}

	getAllParams() {
		return this.params
	}

	hasRequiredParameters() {
		for (param of this.params) {
			if (param.required) {
				return true
			}
		}
		return false
	}

	static resolveParam(field, params) {
		if (field.value.substr(0, 1) == '=') {

			let paramName = field.name
			if (field.value.length > 1) {
				paramName = field.value.substr(1)
			}

			if (params.params && params.params[paramName]) {
				return params.params[paramName]
			}
			if (params.data && params.data[paramName]) {
				return params.data[paramName]
			}
			if (params[paramName]) {
				return params[paramName]
			}
			throw "param not found" + paramName
		}

		//if field.substr(0, 1) == '$'
		// TODO: need to handle computation with $now
		//	if field == '$now'
		//		return new Date()
		return field.value
	}
}

module.exports = Query
