import { Condition, ICondition } from './condition'
import { DBEntity } from '../../db-entity'

import { Query, QueryParamResolver, IQueryParam } from '../../query'

/*
Conditions manage a list of condition (associated with `operand`)
Conditions structure:
[
	{
		name: string,
		operator: string,
		value: string,
		operand: string (optional|default:AND)
		priorityLevel: integer (optional|default:0)
	},
	{
		...
	}
]
*/

export type IConditions = ICondition[]

export class Conditions {
	conditions: Array<Condition>

	constructor(conditions:Array<ICondition>, private entity: DBEntity) {
		this.conditions = []

		if (conditions) {
			for (let condition of conditions) {
				this.conditions.push(new Condition(condition, entity && entity.name))
			}
		}
	}

	toSequelize(params: Array<any>, entityName: string) {
		params = params || []

		let startOperandPriority = false
		let where = ""
		let sequelizeParams = []

		let dbInterface = this.entity.app.database.interface

		this.conditions.forEach((condition) => {
			if (condition && condition.name && condition.operator && condition.entity == entityName) {
				let resolvedParam = QueryParamResolver.resolve(condition, params)
				if (where.length > 0) {
					where += ' ' + condition.operand + ' '
				}

				if (condition.operandPriority && ! startOperandPriority) {
					where += "("
					startOperandPriority = true
				}

				where += dbInterface.quoteIdentifier(condition.entity) + '.'
				where += dbInterface.quoteIdentifier(condition.name) + ' '
				where += condition.operator
				if (condition.operator != 'IS NOT NULL' && condition.operator != 'IS NULL') {
					where += ' ?'

					//TODO: resolve param using type to CAST value
					sequelizeParams.push(resolvedParam)
				}

				if ( ! condition.operandPriority && startOperandPriority) {
					where += ")"
					startOperandPriority = false
				}
			}
		})
		if (startOperandPriority) {
			where += ')'
		}

		sequelizeParams.unshift(where)
		return sequelizeParams
	}

	constructConditions(entities, params) {
		for (let entity of entities) {
			for (let condition of this.conditions) {
				if (condition && condition.entity == entity.model.name) {
					entity.where = this.toSequelize(params, condition.entity)
				}
				if (entity.include) {
					this.constructConditions(entity.include, params)
				}
			}
		}
	}

	discoverParams():Array<IQueryParam> {
		let params = [] as IQueryParam[]
		this.conditions.forEach(condition => {
			if (condition.valueIsParam()) {
				let field;
				if (condition.entity != this.entity.name) {
					field = this.entity.app.entities.get(condition.entity).getField(condition.name)
				}
				else {
					field = this.entity.getField(condition.name)
				}

				let paramName = condition.name
				if (condition.value.length > 1) {
					paramName = condition.value.substr(1)
				}
				params.push({
					name: paramName,
					reference: {
						entity: condition.entity,
						field: condition.name
					},
					type: field.type,
					component: field.component,
					required: true
				})
			}
		})
		return params
	}

	toJson() {
		let res = []
		this.conditions.forEach((condition) => {
			res.push(condition.toJson())
		})
		return res
	}
}