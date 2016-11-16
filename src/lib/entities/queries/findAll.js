'use strict';

var Query = require('../query')
var Conditions = require('./utils/conditions')

class FindAllQuery extends Query {
	constructor(entity, id, params, opts) {
		super(entity, id, params)
		if (!opts) {
			opts = {}
		}

		this.opts = opts
		this.type = 'findAll'
		this.conditions = new Conditions(opts.conditions, entity)
		this.include = opts.include || []

		this.limit = opts.limit || 30

		if (!opts.offset && opts.page) {
			this.page = opts.page
			this.offset = null
		}
		else {
			this.offset = opts.offset || 0
			this.page = null
		}

		this.orderBy = opts.orderBy || []

		this.refresh()
	}

	refresh() {
		this.select = this.opts.select
		if (!this.select || this.select == []) {
			this.select = []
			this.entity.fields.forEach((field) => {
				if (field.read) {
					this.select.push(field.name)
				}
			})
		}
	}

	run(params, options) {
		let include = []
		let includeNames = this.include

		this._constructInclude(include, includeNames)

		let pagination = this.getPagination(params)
		let principalConditions = []

		let raw = false
		if (options && options.raw) {
			raw = true
		}

		let opts = {
			attributes: this.select,
			where: this.conditions.toSequelize(params, this.entity.name),
			include: include,
			raw: raw
		}

		//Add conditions to opts recursively for included obj
		this._constructConditions(opts.include, params)


		if (pagination) {
			if (pagination.offset) {
				opts.offset = pagination.offset
			}
			if (pagination.limit) {
				opts.limit = pagination.limit
			}
		}

		opts.order = []
		this.orderBy.forEach((order) => {
			let ascTxt = 'ASC'
			if (order.desc) {
				ascTxt = 'DESC'
			}
			opts.order.push([order.field, ascTxt]);
		})

		return this.entity.model.findAndCountAll(opts)/*.then((data) => {
			for (let item in data.rows)
				data.rows[item] = data.rows[item]
			return data
		})*/
	}

	_paramResolver(name, value, params, defaultValue) {
		let tmp;
		try {
			tmp = Query.resolveParam({ name: name, value: value }, params)
			if (!tmp) {
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
		if (this.opts.select) {
			res.opts.select = this.opts.select
		}
		if (this.conditions.toJson() != []) {
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

		if (this.opts.orderBy) {
			res.opts.orderBy = this.opts.orderBy
		}

		return res
	}
}

module.exports = FindAllQuery
