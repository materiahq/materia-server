'use strict';
var DBQuery = require('./base')
var Conditions = require('./utils/conditions')
var Sequelize = require('sequelize')

class FindOneQuery extends DBQuery {
	constructor(entity, id, params, opts) {
		super(entity, id, params)

		if ( ! opts) {
			opts = {}
		}
		this.type = 'findOne'
		this.include = opts.include || []
		this.select = opts.select
		this.conditions = new Conditions(opts.conditions)

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
			return new Promise((accept, reject) => {
				this.entity.model.findAll(opts).then(
					function(data) {
						accept(data[0] && data[0].toJSON())
					},
					function(err) { reject(err) }
				)
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
		if ( this.include ) {
			res.opts.include = this.include
		}
		if ( this.select ) {
			res.opts.select = this.select
		}
		if ( this.conditions.toJson() != []) {
			res.opts.conditions = this.conditions.toJson()
		}
		if ( this.include ) {
			res.opts.include = this.include
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
