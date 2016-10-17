'use strict';

var Condition = require('./condition')
var Query = require('../../query')

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

class Conditions {
	constructor(conditions) {
		this.conditions = []

		// if conditions is an object (a single condition)
		if (conditions && !Array.isArray(conditions)) {
			conditions = [conditions]
		}
		else if (!conditions) {
			conditions = []
		}
		conditions.forEach((condition) => {
			this.conditions.push(new Condition(condition))
		})
	}

	toSequelize(params, entityName, parentEntity) {
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
				try {
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
				} catch (e) {
					//TODO: do something when a condition goes wrong
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

	toJson() {
		let res = []
		this.conditions.forEach((condition) => {
			res.push(condition.toJson())
		})
		return res
	}
}

module.exports = Conditions
