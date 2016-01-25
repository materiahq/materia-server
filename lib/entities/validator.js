'use strict';

class Validator {
	constructor(field, name, value) {
		this.field = field
		this.name = name
		this.value = value
	}
	toJson() {
		return { name: this.name, value: this.value }
	}
}

module.exports = Validator
