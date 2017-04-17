import { Query, QueryParamResolver } from '../query'
import MateriaError from '../../error'

export class SQLQuery extends Query {
	type: string
	//TODO: remove values & opts.values as it could be deduct form opts.params
	values: any
	query: string
	valuesType: any

	constructor(entity, id, opts) {
		super(entity, id)

		if ( ! opts || ! opts.query )
			throw new MateriaError('Missing required parameter "query"')

		this.type = 'sql'

		this.params = opts.params || []
		this.values = opts.values || {}
		this.query = opts.query

		this.refresh()
		this.discoverParams()
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

	discoverParams() {
		//does nothing as params is defined in opts.params
		//cf constructor
	}

	resolveParams(params) {
		let res = {}
		for (let field in this.values) {
			try {
				res[field] = QueryParamResolver.resolve({ name: field, value: this.values[field] }, params)
			} catch (e) {
				if ( this.values[field].substr(0, 1) == '=') {
					let t = this.getParam(this.values[field].substr(1))
					if (t && t.required) {
						throw e
					}
				}
			}
		}
		for (let field of this.params) {
			if ( ! this.values[field.name]) {
				try {
					res[field.name] = QueryParamResolver.resolve({ name: field.name, value: "=" }, params)
				} catch(e) {
					if (field.required)
						throw e
				}
			}
		}

		return res
	}

	run(params):Promise<any> {
		this.entity.app.logger.log(`(Query) SQL - Run ${this.entity.name}.${this.id}`)

		let resolvedParams
		try {
			resolvedParams = this.resolveParams(params)
		} catch (e) {
			return Promise.reject(e)
		}

		for (let param of this.params) {
			if (resolvedParams[param.name]) {
				if (typeof resolvedParams[param.name] == 'string') {
					if (param.type == 'date')
						resolvedParams[param.name] = new Date(resolvedParams[param.name])
				}
			}
		}
		this.entity.app.logger.log(` └── Parameters: ${JSON.stringify(resolvedParams)}`)
		this.entity.app.logger.log(` └── Query: ${this.query}\n`)

		return this.entity.app.database.sequelize.query(this.query, {
			replacements: resolvedParams,
			type: this.entity.app.database.sequelize.QueryTypes.SELECT
		})
	}

	toJson() {
		let res = {
			id: this.id,
			type: 'sql',
			opts: {
				params: this.paramsToJson(),
				values: this.values,
				query: this.query
			}
		}
		return res
	}
}