'use strict';

import { Condition, ICondition } from './condition'
import { DBEntity } from '../../db-entity'

import { Query } from '../../query'

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

export class Conditions {
	conditions: Array<Condition>

	constructor(conditions:any, parentEntity: DBEntity) {
		this.conditions = []

		// if conditions is an object (a single condition)
		if (conditions && !Array.isArray(conditions)) {
			conditions = [conditions]
		}
		else if (!conditions) {
			conditions = []
		}
		conditions.forEach((condition) => {
			this.conditions.push(new Condition(condition, parentEntity && parentEntity.name))
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

		console.log('toSequelize conditions' ,this.conditions)

		this.conditions.forEach((condition, i) => {
			if (condition && condition.name && condition.operator && condition.entity == entityName) {
				let resolvedParam = Query.resolveParam(condition, params)
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

	toJson() {
		let res = []
		this.conditions.forEach((condition) => {
			res.push(condition.toJson())
		})
		return res
	}
}