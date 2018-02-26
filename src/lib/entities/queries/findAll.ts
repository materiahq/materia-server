import { Query, QueryParamResolver } from '../query'
import { Conditions } from './utils/conditions'
import chalk from 'chalk'

export interface IFindAllOpts {
	select?: Array<any>
	include?: Array<any>
	conditions?: Array<any>
	limit?: number
	offset?: number
	page?: number
	orderBy?: Array<string>
}

export interface ISequelizeOpts {
	attributes: string[]
	where: Object
	include?: any
	raw?: boolean
	offset?: number
	page?: number
	limit?: number
	order?: any
}

export class FindAllQuery extends Query {
	opts: any
	type: string
	conditions: Conditions
	include: any
	limit: number|string
	page: number|string
	offset: number|string
	orderBy: any
	select: string[]

	constructor(entity, id, opts: IFindAllOpts) {
		super(entity, id)
		if (!opts) {
			opts = {} as IFindAllOpts
		}

		this.opts = opts
		this.type = 'findAll'
		this.conditions = new Conditions(opts.conditions, this)
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
		this.discoverParams();
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

	discoverParams() {
		this.params = []
		this.params = this.params.concat(this.conditions.discoverParams())

		this.discoverParam('limit', 'number')
		this.discoverParam('page', 'number')
		this.discoverParam('offset', 'number')
	}

	discoverParam(param:string, type:string, required?: boolean) {
		if ( ! required ) {
			required = false
		}
		if (this[param] && typeof this[param] == 'string' && this[param].length > 0 && this[param][0] == '=') {
			let paramName = param
			if (this[param].length > 1) {
				paramName = this[param].substr(1)
			}
			this.params.push({
				name: paramName,
				required: required,
				type: type,
				component: 'input'
			})
		}
	}

	constructSequelizeOpts(params, options) {
		let include = []
		let includeNames = this.include

		this._constructInclude(include, includeNames)

		let pagination = this.getPagination(params)
		let principalConditions = []

		let raw = false
		if (options && options.raw) {
			raw = true
		}

		let sequelizeOpts = {
			attributes: this.select,
			where: this.conditions.toSequelize(params, this.entity.name),
			include: include,
			raw: raw
		} as ISequelizeOpts

		//Add conditions to opts recursively for included obj
		this.conditions.constructConditions(sequelizeOpts.include, params)


		if (pagination) {
			if (pagination.offset) {
				sequelizeOpts.offset = pagination.offset
			}
			if (pagination.limit) {
				sequelizeOpts.limit = pagination.limit
			}
		}

		sequelizeOpts.order = []
		this.orderBy.forEach((order) => {
			let ascTxt = 'ASC'
			if (order.desc) {
				ascTxt = 'DESC'
			}
			sequelizeOpts.order.push([order.field, ascTxt]);
		})

		return sequelizeOpts
	}

	run(params, options):Promise<any> {
		if ( ! options || ! options.silent ) {
			this.entity.app.logger.log(`${chalk.bold('(Query)')} FindAll - Run ${chalk.bold(this.entity.name)}.${chalk.bold(this.id)}`)
			this.entity.app.logger.log(` └── Parameters: ${JSON.stringify(params)}`)
			this.entity.app.logger.log(` └── Options: ${JSON.stringify(options)}`)
		}
		let sequelizeOpts
		try {
			sequelizeOpts = this.constructSequelizeOpts(params, options)
		} catch (e) {
			this.entity.app.logger.log(` └── Error: ${e}\n`)
			return Promise.reject(e)
		}
		if ( ! options || ! options.silent ) {
			this.entity.app.logger.log("");
		}
		//this.entity.app.logger.log(` └── Sequelize: findAndCountAll(${JSON.stringify(sequelizeOpts)})\n`)
		return this.entity.model.findAndCountAll(sequelizeOpts).then(res => {
			res.data = res.rows
			if ( ! options || ! options.raw) {
				res.toJSON = () => {
					return {
						count: res.count,
						data: res.data.map(elt => elt.toJSON())
					}
				}
			}
			return res
		})
	}

	_paramResolver(name, value, params, defaultValue) {
		let tmp;
		try {
			tmp = QueryParamResolver.resolve({ name: name, value: value }, params)
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
			opts: {} as IFindAllOpts
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
		if (Object.keys(res.opts).length == 0) {
			delete res.opts
		}

		return res
	}
}