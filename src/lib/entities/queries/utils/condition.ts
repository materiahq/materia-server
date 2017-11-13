import { DBEntity } from '../../db-entity'
import { MateriaError } from '../../../error'

export interface ICondition {
	entity?: string
	name: string
	operator: string
	value: any
	operand?: string
	operandPriority?: number
}

export class Condition {
	entity: string
	parent: string
	name: string
	operator: string
	value: any
	operand: string
	operandPriority: number

	constructor(condition: ICondition, parentEntity) {
		if ( ! condition.name || ! condition.operator ) {
			throw new MateriaError('Missing required parameter to build a condition')
		}
		this.entity = condition.entity || parentEntity
		this.parent = parentEntity
		this.name = condition.name
		this.operator = condition.operator
		this.value = condition.value == undefined ? '' : condition.value
		this.operand = condition.operand
		//this.priorityLevel = condition.priority || 0
	}

	valueIsParam():boolean {
		return (typeof this.value == 'string' && this.value.length > 0 && this.value[0] == '=')
	}

	toJson():ICondition {
		let res = {
			name: this.name,
			operator: this.operator
		} as ICondition

		if (this.operator.toUpperCase() != "IS NULL" && this.operator.toUpperCase() != "IS NOT NULL") {
			res.value = this.value
		}

		if (this.entity && this.parent && this.entity != this.parent) {
			res.entity = this.entity
		}
		if (this.operand) {
			res.operand = this.operand;
		}

		//if (this.priorityLevel) {
		//	res.priorityLevel = this.priorityLevel;
		//}

		return res;
	}
}