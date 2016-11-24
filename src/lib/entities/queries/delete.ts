import { Query } from '../query'
import { Conditions } from './utils/conditions'

export class DeleteQuery extends Query {
	type: string
	conditions: Conditions

	constructor(entity, id, opts) {
		super(entity, id)
		this.type = 'delete'
		if ( ! opts ) {
			opts = {}
		}
		this.conditions = new Conditions(opts.conditions, entity)
		this.discoverParams()
	}

	refresh() {}
	discoverParams() {
		this.params = []
		this.params = this.params.concat(this.conditions.discoverParams())
	}

	run(params) {
		let sequelizeCond = this.conditions.toSequelize(params, this.entity.name)
		//console.log('delete on condition', sequelizeCond)
		return this.entity.model.destroy({ where: sequelizeCond })
	}

	toJson() {
		let res = {
			id: this.id,
			type: 'delete',
			params: this.params,
			opts: {
				conditions: this.conditions.toJson()
			}
		}
		return res
	}
}