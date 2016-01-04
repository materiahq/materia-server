'use strict'

var expect = require('chai').expect

var Field = require('../lib/entities/abstract/field')

/* global describe, before, it */

describe('Field', () => {
	describe('Constructor', () => {
		let field;
		before(() => {
			field = new Field({name: 'entityName'}, {
				name: 'superField'
			})
		})
		it('should have a name and default value', () => {
			expect(field).to.have.property('name')
			expect(field.name).to.equal('superField')
		})
	})
})
