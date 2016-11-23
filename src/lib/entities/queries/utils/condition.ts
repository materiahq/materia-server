import { DBEntity } from '../../db-entity'

export interface ICondition {
	entity: string
	name: string
	operator: string
	value: any
	operand: string
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
		if ( ! condition.name || ! condition.operator || condition.value === undefined ) {
			throw new Error('missing required parameter to build a condition')
		}
		this.entity = condition.entity || parentEntity
		this.parent = parentEntity
		this.name = condition.name
		this.operator = condition.operator
		this.value = condition.value
		this.operand = condition.operand
		//this.priorityLevel = condition.priority || 0
	}

	valueIsParam(value:any) {
		return (typeof value == 'string' && value.length > 0 && value[0] == '=')
	}

	toJson() {
		let res = {
			name: this.name,
			operator: this.operator,
			value: this.value,
		} as ICondition

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