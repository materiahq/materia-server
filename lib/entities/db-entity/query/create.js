'use strict';
var DBQuery = require('./base')
//var Query = require('../../abstract/query')

class CreateQuery extends DBQuery {
	constructor(entity, id, params, opts) {
		super(entity, id, params)

		this.type = 'create'
		if ( opts ) {
			if ( opts.default ) {
				this.params = []
				this.values = {}
				let fields = entity.getWritableFields()
				fields.forEach((field) => {
					this.params.push({
						name: field.name,
						type: field.type,
						required: field.required
					})
					this.values[field.name] = '='
				})
			}
			else {
				this.values = opts.values
			}
		}

		//console.log(this.id, entity.name, this.params, this.values)

		if ( ! this.values ) {
			this.values = {}
		}
		this.valuesType = {}
		Object.keys(this.values).forEach((field) => {
			if (this.values[field].substr(0, 1) == '=') {
				this.valuesType[field] = 'param'
			}
			else {
				this.valuesType[field] = 'value'
			}
		})
	}

	run(params) {
		//check: if the model is always well loaded before running a query
		//if ( ! this.entity.model) {
		//	this.entity.loadModel()
		//}

		//console.log 'run create', params

		//CHECK: not really sure for the next line... seems working
		//this.from.model.removeAttribute(this.from.getPK().name) if this.from.getPK().autoIncrement
		//console.log(this._entityToSequelize(params))
		return this.entity.model.create(this._entityToSequelize(params))
	}

	toJson() {
		let res = {
			id: this.id,
			type: 'create',
			params: this.params,
			opts: {
				values: this.values
			}
		}
		return res
	}
}

module.exports = CreateQuery
