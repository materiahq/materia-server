'use strict';
var _ = require('lodash')
var Query = require('../../abstract/query')

class DBQuery extends Query {
	constructor(entity, id, params) {
		super(entity, id, params)
	}

	/*
	_conditionsToJson() {
		let res = []
		//console.log this.conditions
		this.conditions.forEach((condition) => {
			//console.log 'in _conditionsToJson loop', condition.field

			//TODO: Check because it seem to be never used...
			if (typeof condition.value != 'string') {
				let v = _.merge({}, condition.value)
				if ( v['$$hashKey'] ) {
					delete v['$$hashKey']
				}
			}

			let entityName = this.entity.name;
			if (condition.field.app && condition.field.app.name) {
				entityName = condition.field.app.name
			}

			res.push({
				field: {
					name: condition.field.name,
					entity: entityName
				},
				op: condition.op,
				value: condition.value,
				valueType: condition.valueType
			})
		})
		return res
	}

	_createConditionFromJson(json) {
		let conditions = []
		if ( ! json) {
			return conditions
		}
		json.forEach((condition) => {
			if (typeof condition.name == 'string') {
				//console.log 'create condition form json', condition
				let arr = condition.name.split('.')
				if (arr.length == 1) {
					condition.field = this.entity.getField(condition.name)
				}
				else {
					condition.field = this.entity.app.entities.get(arr[0]).getField(arr[1])
				}
				conditions.push(condition)
			}
			else {
				conditions.push(condition)
			}
		})
		return conditions
	}

	_conditionsToSequelize(params) {
		let startOperandPriority = false
		let res = {
			where: "",
			params: []
		}
		if ( ! params ) {
			params = []
		}

		//console.log 'before resolving conditions for sequelize', this.conditions, params

		this.conditions.forEach((condition, i) => {
			if (condition && condition.name && condition.operator) {
				try {
					//console.log('in for in condition', condition.value, params)
					let resolvedParam = this._resolveParam(condition, params)
					if (i > 0) {
						res.where += ' ' + this.conditions[i - 1].operand + ' '
					}
					if (condition.operandPriority && ! startOperandPriority) {
						res.where += "("
						startOperandPriority = true
					}

					res.where += condition.name + ' ' + condition.operator + ' ?'
					//TODO: resolve param using type to CAST value
					//console.log(condition.field.type, resolvedParam)
					res.params.push(resolvedParam)

					if ( ! condition.operandPriority && startOperandPriority) {
						res.where += ")"
						startOperandPriority = false
					}
				} catch (e) {
					//console.log('error: next', e)
				}
			}
		})
		if (this.conditions.length > 2) {
			if ( this.conditions[this.conditions.length - 1].operandPriority ) {
				res.where += ')'
			}
		}

		res.params.unshift(res.where)
		//console.log 'resolve conditions for sequelize', res.params
		return res.params
	}
	*/

	_entityToSequelize(params) {
		let res = {}

		//console.log 'before entityToSequelize', this.values, params
		Object.keys(this.values).forEach((field) => {
			try {
				res[field] = DBQuery.resolveParam({ name: field, value: this.values[field] }, params)
			} catch (e) {
				//console.log 'next'
			}
		})
		//console.log 'entityToSequelize', res
		return res
	}
}

module.exports = DBQuery
