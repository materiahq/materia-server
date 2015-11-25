var expect = require('chai').expect
var path = require('path')

var Entities = require('../lib/entities')
var mockApp = require('./mock/app')

var Entity = require('../lib/entities/abstract/entity')
var History = require('../lib/history')
var DBEntity = require('../lib/entities/db-entity')

var entities;

describe('Entities Manager', () => {
	describe('Constructor', () => {
		beforeEach(() => {
			mockApp.path = path.join(__dirname, 'samples', 'todo-app')
			mockApp.history = new History(mockApp)
			entities = new Entities(mockApp)
		})

		it('should load entities', (done) => {
			entities.load()
			expect(Object.keys(entities.entities).length).to.equal(1)
			expect(entities.entities["Todo"].name).to.equal('Todo')
			done()
		})

		it('should add basic entity', () => {
			entities.add(new Entity(mockApp, 'testEntity', [
				{
					name: 'id',
					type: 'number',
					required: true
				},
				{
					name: 'content',
					type: 'text',
					required: true
				}
			]))

			expect(entities.findAll().length).to.equal(1)
			expect(entities.findAll()[0].name).to.equal('testEntity')
			expect(entities.findAll()[0].fields.length).to.equal(2)
		})

		it('should remove entity', () => {
			entities.add(new Entity(mockApp, 'testEntity', [
				{
					name: 'id',
					type: 'number',
					required: true
				},
				{
					name: 'content',
					type: 'text',
					required: true
				}
			]))
			entities.remove('testEntity')
			expect(entities.findAll().length).to.equal(0)
		})
	})
})
