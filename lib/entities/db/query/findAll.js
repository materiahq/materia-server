'use strict';
var DBQuery = require('./base')
var Conditions = require('./utils/conditions')

class FindAllQuery extends DBQuery {
	constructor(entity, id, params, opts) {
		super(entity, id, params)
		if ( ! opts) {
			opts = {}
		}

		this.opts = opts
		this.type = 'findAll'
		this.conditions = new Conditions(opts.conditions)
		this.include = opts.include || []
		this.limit = opts.limit
		this.offset = opts.offset

		if ( ! this.limit) {
			this.limit = 30
		}
		if ( ! this.offset) {
			this.offset = 0
		}
		
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
			this.select.push('createdAt')
			this.select.push('updatedAt')
		}
	}

	run(params) {
		//if ( ! this.entity.model) {
		//	this.entity.loadModel()
		//}
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
			include: include,
			offset: this.offset,
			limit: this.limit
		}
		
		//TODO: opts.order
		//console.log(opts)
		return new Promise((accept, reject) => {
			this.entity.model.findAll(opts).then(
				function(data) {
					for (let item in data)
						data[item] = data[item].toJSON()
					accept(data)
				},
				function(err) { reject(err) }
			)
		})
	}

	toJson() {
		let res = {
			id: this.id,
			type: 'findAll',
			params: this.params,
			opts: {}
		}
		if ( this.opts.select ) {
			res.opts.select = this.opts.select
		}
		if ( this.conditions.toJson() != []) {
			res.opts.conditions = this.conditions.toJson()
		}
		if (this.opts.include) {
			res.opts.include = this.opts.include
		}
		if (this.opts.offset) {
			res.opts.offset = this.opts.offset
		}
		if (this.opts.limit) {
			res.opts.limit = this.opts.limit
		}
		return res
	}
}

module.exports = FindAllQuery
