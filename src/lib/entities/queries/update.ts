import { Query } from '../query'
import { Conditions } from './utils/conditions'

export class UpdateQuery extends Query {
	type: string
	values: any
	conditions: Conditions
	valuesType: any

	constructor(entity, id, params, opts) {
		super(entity, id, params)

		this.type = 'update'

		//console.log('constructor update', opts)
		this.values = []
		if ( ! opts ) {
			opts = {}
		}
		if (opts.values) {
			this.values = opts.values
		}

		this.conditions = new Conditions(opts.conditions, entity)

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
		let updates = this.resolveParams(params)
		let where = this.conditions.toSequelize(params, this.entity.name)
		return this.entity.model.update(updates, { where: where })
	}

	toJson() {
		let res = {
			id: this.id,
			type: 'update',
			params: this.params,
			opts: {
				values: this.values,
				conditions: this.conditions.toJson()
			}
		}
		return res
	}
}