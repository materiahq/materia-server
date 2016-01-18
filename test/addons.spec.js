'use strict'

var expect = require('chai').expect
var request = require('request')

var App = require('../lib/app')

var mockTools = require('./mock/tools')

const appDir = __dirname + '/samples/simple-addon-app'

describe('Addons', () => {
	var app;

	before((done) => {
		mockTools.cleanAppDir(appDir, (err) => {
			if (err)
				return done(err)
			app = new App('Test', appDir, {silent:true})
			app.load().then(done).catch(done)
		})
	})

	it('should load the basic auth addon', (done) => {
		expect(app.addons.getLength()).to.equal(1)
		expect(app.api.endpoints.length).to.equal(1)
		app.start().then(() => {
			request.get('http://localhost:8080/api/hello', function(error, response, body) {
				expect(error).to.equal(null)
				expect(response.statusCode).to.equal(200)
			})
			app.stop()
			done()
		}).catch(done)
	})
})
