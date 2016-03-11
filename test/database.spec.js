'use strict'

var fs = require('fs')
var path = require('path')

var expect = require('chai').expect

var Database = require('../lib/database')

var mockApp = require('./mock/app');

describe('Database', () => {
	describe('load()', () => {
		var db;

		beforeEach(() => {
			db = new Database(mockApp)
		})

		it('should load the postgres DB from path', (done) => {
			let result = db.load()
			expect(result).to.equal(true)
			expect(db.host).to.equal('localhost123')
			expect(db.port).to.equal(5432)
			expect(db.username).to.equal('testusername')
			expect(db.password).to.equal('testpassword')
			expect(db.database).to.equal('test')
			done()
		})

		it('should load static settings', () => {
			let result = db.load({
				username: 'test',
				password: 'test2',
				database: 'test3',
				type: 'postgres',
				host: 'myhost.dev',
				port: 1234
			})

			expect(result).to.equal(true)
			expect(db.username).to.equal('test')
			expect(db.password).to.equal('test2')
			expect(db.database).to.equal('test3')
			expect(db.type).to.equal('postgres')
			expect(db.host).to.equal('myhost.dev')
			expect(db.port).to.equal(1234)
		})
	})

	describe('save() + toJson()', () => {
		var db;

		it('should save current settings to FS', () => {
			db = new Database(mockApp)
			db.load({
				username: 'test',
				password: 'test2',
				database: 'test3',
				type: 'postgres',
				host: 'myhost.dev',
				port: 1234
			})
			db.save()
			let content = fs.readFileSync(path.join(mockApp.path, 'database.json'))
			let json = JSON.parse(content.toString())
			expect(json.username).to.equal('test')
			expect(json.password).to.equal('test2')
			expect(json.database).to.equal('test3')
			expect(json.type).to.equal('postgres')
			expect(json.host).to.equal('myhost.dev')
			expect(json.port).to.equal(1234)
		})

		after(() => {
			let json = {
			  "type": "postgres",
			  "host": "localhost123",
			  "port": "5432",
			  "database": "test",
			  "username": "testusername",
			  "password": "testpassword"
			}
			fs.writeFileSync(path.join(mockApp.path, 'database.json'), JSON.stringify(json, null, '\t'))
		})
	})

	describe('start()', () => {
		var db

		beforeEach(() => {
			db = new Database(mockApp)
			db.load()
		})

		it('should throw an error if bad configuration', (done) => {
			db.start().then(() => {
				done('This configuration should not work')
			}).catch((e) => {
				db.stop()
				done()
			})
		})

		it('should start the database', (done) => {
			let content = fs.readFileSync(path.join(__dirname, 'samples', 'database.json'))
			let json = JSON.parse(content.toString())
			db.load(json)
			db.start().then(() => {
				expect(db.sequelize).to.be.an('Object')
				db.stop()
				done()
			}).catch(done)
		})


		it('should restart the database if the db is already started', (done) => {
			let content = fs.readFileSync(path.join(__dirname, 'samples', 'database.json'))
			let json = JSON.parse(content.toString())
			db.load(json)
			db.start().then(() => {
				db.start().then(() => {
					db.stop()
					done()
				}).catch(done)
			}).catch(done)
		})
	})

	describe('stop()', () => {
		var db

		beforeEach(() => {
			db = new Database(mockApp)
			let content = fs.readFileSync(path.join(__dirname, 'samples', 'database.json'))
			let json = JSON.parse(content.toString())
			db.load(json)
		})

		it('should do nothing if db is not started', (done) => {
			db.stop()
			done()
		})

		it('should stop the db', (done) => {
			db.start().then(() => {
				db.stop()
				expect(db.sequelize).to.not.exist
				done()
			})
		})
	})

	//TODO:
	/*describe('define()', () => {
		it('should translate a Materia Entity to a Sequelize Model', () => {

		})
		it('should translate type to Sequelize', () => {

		})

		it('should translate field to Sequelize', () => {

		})
	})*/
})
