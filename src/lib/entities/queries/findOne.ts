import { Query } from '../query'
import { Conditions } from './utils/conditions'
import chalk from 'chalk'

export class FindOneQuery extends Query {
	opts: any
	type: string
	include: any
	conditions: Conditions
	orderBy: any
	select: any

	constructor(entity, id, opts) {
		super(entity, id)

		if ( ! opts) {
			opts = {}
		}
		this.opts = opts
		this.type = 'findOne'
		this.include = opts.include || []
		this.conditions = new Conditions(opts.conditions, this)

		this.orderBy = opts.orderBy || []

		this.refresh()
	}

	discoverParams() {
		this.params = []
		this.params = this.params.concat(this.conditions.discoverParams())
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
		}
		this.discoverParams()
	}

	constructSequelizeOpts(params, options) {
		let include = []
		let includeNames = this.include

		this._constructInclude(include, includeNames)

		let raw = false
		if (options && options.raw) {
			raw = true
		}

		let opts = {
			attributes: this.select,
			where: this.conditions.toSequelize(params, this.entity.name),
			include: include,
			raw: raw
		} as any

		//Add conditions to opts recursively for included obj
		this.conditions.constructConditions(opts.include, params)

		opts.order = []
		this.orderBy.forEach((order) => {
			let ascTxt = 'ASC'
			if (order.desc) {
				ascTxt = 'DESC'
			}
			opts.order.push([order.field, ascTxt]);
		})
		return opts
	}

	run(params, options):Promise<any> {
		this.entity.app.logger.log(`${chalk.bold('(Query)')} FindOne - Run ${chalk.bold(this.entity.name)}.${chalk.bold(this.id)}`)
		this.entity.app.logger.log(` └── Parameters: ${JSON.stringify(params)}`)
		this.entity.app.logger.log(` └── Options: ${JSON.stringify(options)}`)
		let sequelizeOpts
		try {
			sequelizeOpts = this.constructSequelizeOpts(params, options)
		} catch (e) {
			return Promise.reject(e)
		}
		//this.entity.app.logger.log(` └── Sequelize: findAndCountAll(${JSON.stringify(sequelizeOpts)})\n`)
		return this.entity.model.findOne(sequelizeOpts)
	}

	toJson() {
		let res = {
			id: this.id,
			type: 'findOne',
			opts: {}
		} as any

		if ( this.opts.include ) {
			res.opts.include = this.opts.include
		}
		if ( this.opts.select ) {
			res.opts.select = this.opts.select
		}
		if ( this.conditions.toJson() != []) {
			res.opts.conditions = this.conditions.toJson()
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