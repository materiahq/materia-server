import { Query } from '../query'

export class CreateQuery extends Query {
	type: string
	opts: any
	values: any
	valuesType: any

	constructor(entity, id, params, opts) {
		super(entity, id, params)

		this.type = 'create'
		this.opts = opts
		this.entity = entity
		this.refresh()
	}

	refresh() {
		if ( this.opts ) {
			if ( this.opts.default ) {
				this.params = []
				this.values = {}
				let fields = this.entity.getWritableFields()
				fields.forEach((field) => {
					this.params.push({
						name: field.name,
						type: field.type,
						required: field.required
					})
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
		return this.entity.model.create(this.resolveParams(params))
	}

	toJson() {
		let res = {
			id: this.id,
			type: 'create',
			params: this.params,
			opts: {
				values: this.values
			}
		}
		return res
	}
}