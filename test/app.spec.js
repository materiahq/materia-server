var expect = require('chai').expect
var App = require('../lib/app')

var app;

describe('App', () => {
	describe('#load()', () => {

		before(() => {
		})

		beforeEach((done) => {
			app = new App('Test', __dirname + '/samples/todo-app')
			app.load().then(done).catch(done)
		})

		it('should load the app, load the db configuration and connect the DB', () => {
			expect(app.name).to.equal('Test')
		})

		after(() => {
		})
	})
})
