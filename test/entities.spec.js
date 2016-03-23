'use strict'

var path = require('path')

var expect = require('chai').expect

var Entities = require('../lib/entities')
var Entity = require('../lib/entities/entity')
var History = require('../lib/history')
var DBEntity = require('../lib/entities/db-entity')

var mockApp = require('./mock/app')
var mockTools = require('./mock/tools')

var entities;

const appDir = path.join(__dirname, 'samples', 'todo-app')

describe('Entities Manager', () => {
	describe('Constructor', () => {
		beforeEach((done) => {
			mockApp.path = appDir
			mockTools.cleanAppDir(appDir, (err) => {
				if (err)
					return done(err)
				mockApp.history = new History(mockApp)
				entities = new Entities(mockApp)
				done()
			})
		})

		it('should load entities', (done) => {
			entities.load().then(() => {
				expect(Object.keys(entities.entities).length).to.equal(1)
				expect(entities.entities["Todo"].name).to.equal('Todo')
				done()
			}, (err) => {
				done(err)
			})
		})

		it('should add basic entity', (done) => {
			let entity = new Entity(mockApp, 'testEntity')
			entity.create([
				{
					name: 'id',
					type: 'number',
					required: true,
                    primary: true
				},
				{
					name: 'content',
					type: 'text',
					required: true
				}
			]).then(() => {
				return entities.add(entity, {db:false})
			}).then(() => {
				expect(entities.findAll().length).to.equal(1)
				expect(entities.findAll()[0].name).to.equal('testEntity')
				expect(entities.findAll()[0].fields.length).to.equal(2)
				done()
			}).catch((err) => {
				done(err)
			})
		})

		it('should remove entity', (done) => {
			let entity = new Entity(mockApp, 'testEntity')
			entity.create([
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
			]).then(() => {
				return entities.add(entity, {db:false})
			}).then(() => {
				return entities.remove('testEntity', {db:false})
			}).then(() => {
				expect(entities.findAll().length).to.equal(0)
				done()
			}).catch((err) => {
				done(err)
			})
		})
	})
})
