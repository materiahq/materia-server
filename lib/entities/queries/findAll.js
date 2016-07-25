'use strict';

var Query = require('../query')
var Conditions = require('./utils/conditions')

class FindAllQuery extends Query {
	constructor(entity, id, params, opts) {
		super(entity, id, params)
		if ( ! opts) {
			opts = {}
		}

		this.opts = opts
		this.type = 'findAll'
		this.conditions = new Conditions(opts.conditions)
		this.include = opts.include || []

		this.limit = opts.limit || 30

		if ( ! opts.offset && opts.page ) {
			this.page = opts.page
			this.offset = null
		}
		else {
			this.offset = opts.offset || 0
			this.page = null
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

		let pagination = this.getPagination(params)

		let opts = {
			attributes: this.select,
			where: where,
			include: include
		}

		if ( pagination ) {
			if (pagination.offset) {
				opts.offset = pagination.offset
			}
			if (pagination.limit) {
				opts.limit = pagination.limit
			}
		}

		//TODO: opts.order
		//console.log(opts)
		return new Promise((accept, reject) => {
			this.entity.model.findAndCountAll(opts).then(
				function(data) {
					for (let item in data.rows)
						data.rows[item] = data.rows[item].toJSON()
					accept(data)
				},
				function(err) { reject(err) }
			)
		})
	}

	_paramResolver(name, value, params, defaultValue) {
		let tmp;
		try {
			tmp = Query.resolveParam({name: name, value: value}, params)
			if ( ! tmp ) {
				throw 'error'
			}
		}
		catch (e) {
			tmp = defaultValue
		}
		return tmp
	}

	getPagination(params) {
		let limit, offset;

		limit = this._paramResolver('limit', this.limit, params, null)

		if (this.page) {
			let page = this._paramResolver('page', this.page, params, 1)
			offset = (page - 1) * limit
		}
		else {
			offset = this._paramResolver('offset', this.offset, params, 0)
		}

		return {
			limit: limit,
			offset: offset
		}
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
		if (this.opts.page) {
			res.opts.page = this.opts.page
		}

		return res
	}
}

module.exports = FindAllQuery
