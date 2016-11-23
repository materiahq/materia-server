import { Query } from '../query'

export class SQLQuery extends Query {
	type: string
	params: any
	values: any
	query: string
	valuesType: any

	constructor(entity, id, params, opts) {
		super(entity, id, params)

		if ( ! opts || ! opts.query )
			throw new Error('missing required parameter "query"')

		this.type = 'sql'

		this.params = params || {}
		this.values = opts.values || {}
		this.query = opts.query

		this.refresh()
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

	resolveParams(params) {
		let res = {}
		for (let field in this.values) {
			try {
				res[field] = Query.resolveParam({ name: field, value: this.values[field] }, params)
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
					res[field.name] = Query.resolveParam({ name: field.name, value: "=" }, params)
				} catch(e) {
					if (field.required)
						throw e
				}
			}
		}

		return res
	}

	run(params) {
		let resolvedParams = this.resolveParams(params)

		for (let param of this.params) {
			if (resolvedParams[param.name]) {
				if (typeof resolvedParams[param.name] == 'string') {
					if (param.type == 'date')
						resolvedParams[param.name] = new Date(resolvedParams[param.name])
				}
			}
		}

		return this.entity.app.database.sequelize.query(this.query, {
			replacements: resolvedParams,
			type: this.entity.app.database.sequelize.QueryTypes.SELECT
		})
	}

	toJson() {
		let res = {
			id: this.id,
			type: 'sql',
			params: this.params,
			opts: {
				values: this.values,
				query: this.query
			}
		}
		return res
	}
}