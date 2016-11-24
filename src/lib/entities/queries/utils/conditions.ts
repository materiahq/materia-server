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

		// if conditions is an object (a single condition)
		//if (conditions && !Array.isArray(conditions)) {
		//	conditions = [conditions]
		//}
		//else
		if (!conditions) {
			conditions = []
		}
		conditions.forEach((condition) => {
			this.conditions.push(new Condition(condition, entity && entity.name))
		})
	}

	toSequelize(params: Array<any>, entityName: string) {
		let startOperandPriority = false
		let res = {
			where: "",
			params: []
		}
		if (!params) {
			params = []
		}

		this.conditions.forEach((condition, i) => {
			if (condition && condition.name && condition.operator && condition.entity == entityName) {
				let resolvedParam = QueryParamResolver.resolve(condition, params)
				if (i > 0) {
					if (this.conditions[i].entity == entityName && res.where.length > 0) {
						res.where += ' ' + (this.conditions[i].operand) + ' '
					}

				}
				if (condition.operandPriority && !startOperandPriority) {
					res.where += "("
					startOperandPriority = true
				}

				if (condition.operator == 'IS NOT NULL' || condition.operator == 'IS NULL') {
					res.where += condition.name + ' ' + condition.operator
				}
				else {
					res.where += condition.name + ' ' + condition.operator + ' ?'
					//TODO: resolve param using type to CAST value
					res.params.push(resolvedParam)
				}

				if (!condition.operandPriority && startOperandPriority) {
					res.where += ")"
					startOperandPriority = false
				}
			}
		})
		if (this.conditions.length > 2) {
			if (this.conditions[this.conditions.length - 1].operandPriority) {
				res.where += ')'
			}
		}

		res.params.unshift(res.where)
		return res.params
	}

	constructConditions(entities, params) {
		for (let x in entities) {
			let entity = entities[x]
			for (let i in this.conditions) {
				let condition = this.conditions[i]
				if (this.conditions[i] && this.conditions[i].entity == entity.model.name) {
					if (entity.model.name != condition.entity) {
						entity.where = this.toSequelize(params, entity.model.name)
					} else {
						entity.where = this.toSequelize(params, entity.model.name)
					}
				}
				if (entity.include) {
					this.constructConditions(entity.include, params)
				}
			}
		}
	}

	discoverParams():Array<IQueryParam> {
		let params = []
		this.conditions.forEach(condition => {
			if (condition.valueIsParam()) {
				let type;
				if (condition.entity != this.entity.name) {
					type = this.entity.app.entities.get(condition.entity).getField(condition.name).type
				}
				else {
					type = this.entity.getField(condition.name).type
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
					type: type,
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