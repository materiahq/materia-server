'use strict';

var Query = require('../query')
var Conditions = require('./utils/conditions')

class UpdateQuery extends Query {
	constructor(entity, id, params, opts) {
		super(entity, id, params)

		this.type = 'update'

		//console.log('constructor update', opts)
		this.values = []
		if ( ! opts ) {
			opts = {}
		}
		if (opts.values) {
			this.values = opts.values
		}

		this.conditions = new Conditions(opts.conditions, entity)

		this.refresh()
	}

	refresh() {
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
		let updates = this.resolveParams(params)
		let where = this.conditions.toSequelize(params, this.entity.name)
		return this.entity.model.update(updates, { where: where })
	}

	toJson() {
		let res = {
			id: this.id,
			type: 'update',
			params: this.params,
			opts: {
				values: this.values,
				conditions: this.conditions.toJson()
			}
		}
		return res
	}
}

module.exports = UpdateQuery
