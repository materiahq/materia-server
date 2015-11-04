var expect = require('chai').expect
var App = require('../lib/app')

var app;
var request = require('request')

describe('Addons', () => {
	before(() => {
	})

	beforeEach((done) => {
		app = new App('Test', __dirname + '/samples/simple-addon-app')
		app.load().then(done).catch(done)
	})

	it('should load the basic auth addon', () => {
		expect(app.addons.getLength()).to.equal(1)
		expect(app.api.endpoints.length).to.equal(1)
		app.start().then(() => {
			request.get('http://localhost:8080/api/hello', function(error, response, body) {
				expect(error).to.equal(null)
				expect(response.statusCode).to.equal(200)
			})
			app.stop()
		})
	})

	after(() => {
	})
})
