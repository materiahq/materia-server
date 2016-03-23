'use strict';

var Validator = require('./validator')

class Field {
	constructor(app, field) {
		this.app = app
		this.edit = false

		this.DefaultType = Object.freeze({
			TEXT: 'text',
			NUMBER: 'number',
			DATE: 'date',
			COUNTER: 'counter',
			IMAGE: 'image',
			FILE: 'file',
			STRING: 'string',
			FLOAT: 'float',
			BOOL: 'boolean',
			URL: 'url'
		})

		if ( ! field || ! field.name ) {
			throw new Error("A field must have a name")
		}
		else {
			this.name = field.name
			this.required = field.required || false
			this.primary = field.primary || false
			this.unique = field.unique || false
			this.default = field.default || false
			if (field.default && field.defaultValue != undefined) {
				this.defaultValue = field.defaultValue
			}
			if (field.type == 'string') {
				field.type = 'text'
			}
			this.type = field.type || this.DefaultType.TEXT
			if (this.type.toLowerCase() == this.DefaultType.NUMBER && field.autoIncrement || this.type.toLowerCase() == this.DefaultType.COUNTER) {
				this.autoIncrement = true
			}
			this.read = field.read || true
			this.write = field.write || true
			this.isRelation = field.isRelation || false

			this.validators = []
			if (field.validators) {
				field.validators.forEach((validator) => {
					this.addValidator(validator.name, validator.value);
				})
			}
		}
	}

	setDefaultValue() {
		this.type = 'text'
		this.required = false
		this.primary = false
		this.unique = false
		this.write = true
		this.default = false
		if (this.defaultValue) { delete this.defaultValue }
		if (this.autoIncrement) { delete this.autoIncrement }
	}

	toJson() {
		//let validatorsJson = []
		//for i of this.validators
		//	validatorsJson.push validators[i].toJson()

		let res = {
			name: this.name,
			type: this.type,
			primary: this.primary,
			unique: this.unique,
			required: this.required,
			read: this.read,
			write: this.write,
			//validators: validatorsJson
			default: this.default
		}

		if (this.default && this.defaultValue != undefined) {
			res.defaultValue = this.defaultValue
		}

		if (res.default && res.defaultValue != undefined) {
			if (this.defaultValue == 'true' && this.type.toLowerCase() == 'boolean') {
				res.defaultValue = true
			}
			if (this.defaultValue == 'false' && this.type.toLowerCase() == 'boolean') {
				res.defaultValue = false
			}
			if (this.type.toLowerCase() == 'number') {
				res.defaultValue = Number(this.defaultValue)
				if (res.defaultValue == NaN)
					res.defaultValue = 0
			}
		}

		if (this.autoIncrement) {
			res.autoIncrement = true
		}

		return res
	}

	fillDefault() {
		this.required = this.required || false
		this.primary = this.primary || false
		this.unique = this.unique || false
		this.default = this.default || false
		this.type = this.type || this.DefaultType.TEXT
		if (this.autoIncrement == undefined && this.type.toLowerCase() == this.DefaultType.NUMBER && this.autoIncrement || this.type.toLowerCase() == this.DefaultType.COUNTER) {
			this.autoIncrement = true
		}
		this.read = this.read || true
		this.write = this.write || true
		this.isRelation = this.isRelation || false
	}

	update(field) {
		this.name = field.name
		this.type = field.type
		this.required = field.required
		this.primary = field.primary
		this.unique = field.unique
		this.write = field.write
		this.default = field.default
		this.defaultValue = field.defaultValue
		this.autoIncrement = field.autoIncrement
	}

	setType(type) {
		for (let t of this.DefaultType) {
			if (t == type) {
				return this.type = type
			}
		}
		return false
	}

	addValidator(name, value) {
		this.validators.push(new Validator(this, name, value))
	}

	removeValidator(name) {
		let id = -1
		this.validators.forEach((validator, k) => {
			if (this.validators[k].name == name) {
				id = k
			}
		})
		if (id) {
			return this.validators.splice(id, 1)
		}
		return false
	}
}

module.exports = Field
