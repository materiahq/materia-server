'use strict';

class Condition {
	constructor(condition) {
		if ( ! condition.name || ! condition.operator || ! condition.value ) {
			throw 'missing required parameter to build a condition'
		}
		this.name = condition.name
		this.operator = condition.operator
		this.value = condition.value
		this.operand = condition.operand
		//this.priorityLevel = condition.priority || 0
	}

	valueIsParam() {
		return (value.substr(0, 1) == '=')
	}

	toJson() {
		let res = {
			name: this.name,
			operator: this.operator,
			value: this.value,
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

module.exports = Condition
