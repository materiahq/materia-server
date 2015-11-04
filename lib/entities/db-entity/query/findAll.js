'use strict';
var DBQuery = require('./base')
var Conditions = require('./utils/conditions')

class FindAllQuery extends DBQuery {
	constructor(entity, id, params, opts) {
		super(entity, id, params)
		if ( ! opts) {
			opts = {}
		}

		this.select = opts.select
		this.type = 'findAll'
		this.conditions = new Conditions(opts.conditions)
		this.limit = opts.limit
		this.offset = opts.offset

		//console.log 'IN FIND ALL QUERY', @from
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

		if ( ! this.limit) {
			this.limit = 30
		}
		if ( ! this.offset) {
			this.offset = 0
		}
	}

	run(params) {
		//if ( ! this.entity.model) {
		//	this.entity.loadModel()
		//}

		//console.log('condition:',  this.conditions.toSequelize(params))
		let opts = {
			attributes: this.select,
			where: this.conditions.toSequelize(params)
		}

		opts.offset = this.offset
		opts.limit = this.limit
		opts.raw = true
		//TODO: opts.order
		console.log(opts)
		return this.entity.model.findAll(opts)
	}

	toJson() {
		let res = {
			id: this.id,
			type: 'findAll',
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

module.exports = FindAllQuery
