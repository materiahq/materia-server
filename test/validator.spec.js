'use strict'

var expect = require('chai').expect

var Validator = require('../lib/entities/validator')

describe('Validator', () => {
	describe('Constructor', () => {
		let validator;
		before(() => {
			validator = new Validator({name: 'testField', type: 'text'}, 'MinLength', 4)
		})
		it('should have a name and a value', () => {
			expect(validator).to.have.property('name')
			expect(validator).to.have.property('value')
			expect(validator.name).to.equal('MinLength')
		})

		it('should construct the Validator Object', () => {
				//expect(validator).to.have.property('validatorObject').to.be.instanceof('MinLengthValidator')
		})
	})
})
