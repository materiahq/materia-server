'use strict';

var Query = require('../query')

class CreateQuery extends Query {
	constructor(entity, id, params, opts) {
		super(entity, id, params)

		this.type = 'create'
		this.opts = opts
		this.entity = entity
		this.refresh()
	}

	refresh() {
		if ( this.opts ) {
			if ( this.opts.default ) {
				this.params = []
				this.values = {}
				let fields = this.entity.getWritableFields()
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
				this.values = this.opts.values
			}
		}

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
		return this.entity.model.create(this.resolveParams(params))
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
