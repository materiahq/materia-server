import { Query, QueryParamResolver } from '../query'

export class CreateQuery extends Query {
	type: string
	opts: any
	values: any
	valuesType: any

	constructor(entity, id, opts) {
		super(entity, id)

		this.type = 'create'
		this.opts = opts
		this.entity = entity
		this.refresh()
		this.discoverParams()
	}

	refresh() {
		if ( this.opts ) {
			if ( this.opts.default ) {
				this.params = []
				this.values = {}
				let fields = this.entity.getWritableFields()
				fields.forEach((field) => {
					this.values[field.name] = '='
				})
			}
			else {
				this.values = this.opts.values
			}
		}

		if ( ! this.values ) {
			this.values = {}
		}
	}

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
					required: field.required,
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
		try {
			return this.entity.model.create(this.resolveParams(params))
		} catch (e) {
			return Promise.reject(e)
		}
	}

	toJson() {
		let res = {
			id: this.id,
			type: 'create',
			opts: {
				values: this.values
			}
		}
		return res
	}
}