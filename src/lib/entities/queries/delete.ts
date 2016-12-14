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

	run(params):Promise<any> {
		let sequelizeCond
		try {
			sequelizeCond = this.conditions.toSequelize(params, this.entity.name)
		} catch (e) {
			return Promise.reject(e)
		}

		return this.entity.model.destroy({ where: sequelizeCond })
	}

	toJson() {
		let res = {
			id: this.id,
			type: 'delete',
			opts: {
				conditions: this.conditions.toJson()
			}
		}
		return res
	}
}