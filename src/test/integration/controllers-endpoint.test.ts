import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'

import { App } from '../../lib/app'
import { TemplateApp } from '../mock/template-app'

chai.config.truncateThreshold = 500
chai.use(chaiAsPromised)
var should = chai.should()

describe('[Controller Endpoints]', () => {
	let app: App
	let testObject = {
		param_number: 42,
		param_text: "foo",
		param_float: 0.5,
		param_date: new Date(10),
		param_bool: false
	}
	let testObjectJson = {
		param_number: 42,
		param_text: "foo",
		param_float: 0.5,
		param_date: new Date(10).toJSON(),
		param_bool: false
	}
	let tpl = new TemplateApp('controller-endpoints')

	before(() => {
		return tpl.runApp().then(_app => app = _app)
	})

	after(() => {
		return app.stop()
	})


	describe('App', () => {

		describe('Endpoints', () => {
			it('should run endpoint for default "create", 4 times', () => {
				let create = () => {
					return tpl.post('/api/test')
				}
				return Promise.all([create(), create(), create(), create()]).should.be.fulfilled
			})
			it('should run endpoint for default "get"', () => {
				return tpl.get('/api/test/2').should.become({id_test: 2})
			})
			it('should run endpoint for default "update"', () => {
				return tpl.put('/api/test/2', {
					id_test: 2,
					new_id_test: 42
				}).should.become([1])
			})
			it('should run endpoint for default "delete"', () => {
				return tpl.del('/api/test/3').should.become(1)
			})
			it('should run endpoint for default "list"', () => {
				return tpl.get('/api/tests').should.become({
					count: 3,
					data: [
						{ id_test: 1 },
						{ id_test: 4 },
						{ id_test: 42 }
					]
				})
			})
			it('should run endpoint for model action "testParam" that returns params', () => {
				let testObjectJson = {
					param_number: 42,
					param_text: "foo",
					param_float: 0.5,
					param_date: new Date(10).toJSON(),
					param_bool: true
				}
				return tpl.post('/api/params/true?param_text=bar', testObject)
					.should.become(testObjectJson)
			})
			it('should run endpoint for model action "testParam" with a missing parameter', () => {
				return tpl.post('/api/params/true', {
					param_text: "ok"
				}).should.be.rejectedWith({
					error: true,
					message: 'Missing required parameter'
				})
			})
			it('should run endpoint for controller action "testPromise" that returns a promise', () => {
				return tpl.post('/api/ctrl/promise').should.become({ x: 42 })
			})
			it('should run endpoint for controller action "testExpress" that use res.send', () => {
				return tpl.post('/api/ctrl/express').should.become("ok")
			})
			it('should run endpoint for controller action "testParam" with typed params', () => {
				return tpl.post('/api/ctrl/params', testObject).should.become({
					body: testObjectJson,
					query: {},
					params: {}
				})
			})
			it('should run endpoint for controller action "testParam" with a missing param', () => {
				return tpl.post('/api/ctrl/params', {
					param_number: 42,
					param_text: "bar"
				}).should.be.rejectedWith({
					error: true,
					message: 'Missing required parameter: param_date'
				})
			})
			// This does NOT pass - I don't know why...
			it('should run endpoint using session', (done) => {
				tpl.get('/api/session/init').then(res => {
					res.should.equal('Hello World')
					return tpl.get('/api/session/fetch')
				}).then(res => res.should.equal("Hello World"))
				.then(() => done())
				.catch(e => done(e))
			})
		})
	});
});