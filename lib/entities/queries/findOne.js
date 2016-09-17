'use strict';

var Query = require('../query')
var Conditions = require('./utils/conditions')
//var Sequelize = require('sequelize')

class FindOneQuery extends Query {
	constructor(entity, id, params, opts) {
		super(entity, id, params)

		if ( ! opts) {
			opts = {}
		}
		this.opts = opts
		this.type = 'findOne'
		this.include = opts.include || []
		this.conditions = new Conditions(opts.conditions)

		this.refresh()
	}

	refresh() {
		this.select = this.opts.select
		if ( ! this.select || this.select == [] ) {
			this.select = []
			this.entity.fields.forEach((field) => {
				if (field.read) {
					this.select.push(field.name)
				}
			})
			if (this.entity.createdAt !== false) {
				this.select.push('createdAt')
			}
			if (this.entity.updatedAt !== false) {
				this.select.push('updatedAt')
			}
		}
	}

	run(params) {
		let where = this.conditions.toSequelize(params)

		let include = []
		let includeNames = (typeof this.include == 'string') ? [this.include] : this.include
		for (let entity of includeNames) {
			let includeEntity = this.entity.app.entities.get(entity)
			//let includeWhere = {}
			//let includeFK = includeEntity.getFK(this.entity.name)
			//includeWhere[includeFK.field] = includeFK.reference.entity + '.' + includeFK.reference.field
			//includeWhere[includeFK.reference.field] = Sequelize.col(includeEntity.name + '.' + includeFK.field)
			//console.log ( '-- WHERE --', includeWhere)
			include.push({ model: includeEntity.model })
		}

		let opts = {
			attributes: this.select,
			where: where,
			include: include
		}

		//console.log("--FINDONE--", opts)

		if (includeNames.length > 0)
			return this.entity.model.findAll(opts).then((data) => {
				return data[0] && data[0].toJSON()
			})
		else {
			opts.raw = true
			return this.entity.model.findOne(opts)
		}
	}

	toJson() {
		let res = {
			id: this.id,
			type: 'findOne',
			params: this.params,
			opts: {
			}
		}
		if ( this.opts.include ) {
			res.opts.include = this.opts.include
		}
		if ( this.opts.select ) {
			res.opts.select = this.opts.select
		}
		if ( this.conditions.toJson() != []) {
			res.opts.conditions = this.conditions.toJson()
		}
		return res
	}
}

module.exports = FindOneQuery
