import { Query, QueryParamResolver } from '../query'
import { Conditions, IConditions } from './utils/conditions'
import { DBEntity } from '../db-entity'

export interface IUpdateQueryOpts {
	values: any,
	conditions: IConditions
}

export class UpdateQuery extends Query {
	type: string
	values: any
	conditions: Conditions
	valuesType: any

	constructor(entity: DBEntity, id: string, opts: IUpdateQueryOpts) {
		super(entity, id)

		this.type = 'update'

		//console.log('constructor update', opts)
		this.values = []
		if ( ! opts ) {
			opts = {} as IUpdateQueryOpts
		}
		if (opts.values) {
			this.values = opts.values
		}

		this.conditions = new Conditions(opts.conditions, this)

		this.discoverParams()
	}

	refresh() {}

	discoverParams() {
		this.valuesType = {}
		this.params = []
		Object.keys(this.values).forEach(fieldName => {
			if (this.values[fieldName] && this.values[fieldName].substr(0, 1) == '=') {
				this.valuesType[fieldName] = 'param'
				let paramName = fieldName
				if (this.values[fieldName].length > 1) {
					paramName = this.values[fieldName].substr(1)
				}
				let field = this.entity.getField(fieldName)
				this.params.push({
					name: paramName,
					type: field.type,
					required: false,
					component: field.component,
					reference: {
						entity: this.entity.name,
						field: fieldName
					}
				})
			}
			else {
				this.valuesType[fieldName] = 'value'
			}
		})

		this.params = this.params.concat(this.conditions.discoverParams())
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
		let updates, where
		try {
			updates = this.resolveParams(params)
			where = this.conditions.toSequelize(params, this.entity.name)
		} catch (e) {
			return Promise.reject(e)
		}
		return this.entity.model.update(updates, { where: where })
	}

	toJson() {
		let res = {
			id: this.id,
			type: 'update',
			opts: {
				values: this.values,
				conditions: this.conditions.toJson()
			} as IUpdateQueryOpts
		}
		return res
	}
}