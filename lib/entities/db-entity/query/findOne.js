'use strict';
var DBQuery = require('./base')
var Conditions = require('./utils/conditions')

class FindOneQuery extends DBQuery {
	constructor(entity, id, params, data) {
		super(entity, id, params)

		if ( ! data) {
			data = {}
		}
		this.type = 'findOne'
		this.select = data.select
		this.conditions = new Conditions(data.conditions)

		if ( ! this.select || this.select == [] ) {
			this.select = []
			this.entity.fields.forEach((field) => {
				if (field.read) {
					this.select.push(field.name)
				}
			})
			this.select.push('createdAt')
			this.select.push('updatedAt')
		}
	}

	run(params) {
		if ( ! this.entity.model) {
			this.entity.loadModel()
		}
		let where = this.conditions.toSequelize(params)
		//console.log('in run FindOne', where)
		let opts = {
			attributes: this.select,
			where: where,
			raw: true
		}

		return this.entity.model.findOne(opts)
	}

	toJson() {
		let res = {
			id: this.id,
			type: 'findOne',
			params: this.params,
			opts: {
			}
		}
		if ( this.include ) {
			res.opts.include = this.include
		}
		if ( this.select ) {
			res.opts.select = this.select
		}
		if ( this.conditions.toJson() != []) {
			res.opts.conditions = this.conditions.toJson()
		}
		if (this.limit) {
			res.opts.limit = this.limit
		}
		if (this.offset) {
			res.opts.offset = this.offset
		}
		return res
	}
}

module.exports = FindOneQuery
