'use strict';
class Condition {
    constructor(condition) {
        if (!condition.name || !condition.operator || condition.value === undefined) {
            throw new Error('missing required parameter to build a condition');
        }
        this.entity = condition.entity;
        this.name = condition.name;
        this.operator = condition.operator;
        this.value = condition.value;
        this.operand = condition.operand;
        //this.priorityLevel = condition.priority || 0
    }
    valueIsParam(value) {
        return (typeof value == 'string' && value.length > 0 && value[0] == '=');
    }
    toJson() {
        let res = {
            entity: this.entity,
            name: this.name,
            operator: this.operator,
            value: this.value,
        };
        if (this.operand) {
            res.operand = this.operand;
        }
        //if (this.priorityLevel) {
        //	res.priorityLevel = this.priorityLevel;
        //}
        return res;
    }
}
module.exports = Condition;
//# sourceMappingURL=condition.js.map