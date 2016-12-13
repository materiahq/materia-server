import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import * as rp from 'request-promise'

import App from '../../lib/app'
import { TemplateApp } from '../mock/template-app'

chai.use(chaiAsPromised)
chai.should()

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
	let rpdef = rp.defaults({
		json: true
	})
	let baseurl = "http://localhost:8798/api"

	before(() => {
		let tmpl = new TemplateApp('controller-endpoints')

		app = tmpl.createInstance()
	})

	after(() => {
		return app.stop()
	})


	describe('App', () => {
		it('should load', () => {
			return app.load()
		});
		it('should start', () => {
			return app.start()
		});

		describe('Endpoints', () => {
			it('should run endpoint for default "create", 4 times', () => {
				let create = () => {
					return rpdef.post(baseurl + '/test')
				}
				return Promise.all([create(), create(), create(), create()]).should.be.fulfilled
			})
			it('should run endpoint for default "get"', () => {
				return rpdef.get(baseurl + '/test/2').should.become({
					id_test: 2
				})
			})
			it('should run endpoint for default "update"', () => {
				return rpdef.put(baseurl + '/test/2', {form: {
					id_test: 2,
					new_id_test: 42
				}}).should.become([1])
			})
			it('should run endpoint for default "delete"', () => {
				return rpdef.del(baseurl + '/test/3').should.become(1)
			})
			it('should run endpoint for default "list"', () => {
				return rpdef.get(baseurl + '/tests').should.become({
					count:3,
					rows:[
						{ id_test:1 },
						{ id_test:4 },
						{ id_test:42 },
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
				return rpdef.post(baseurl + '/params/true?param_text=bar', {json: testObject}).should.become(testObjectJson)
			})
			//it('should run endpoint for model action "testParam" with a missing parameter', () => {
			//	return rpdef.post(baseurl + '/params/true', {json: {
			//		param_text: "ok"
			//	}}).should.be.rejectedWith('Missing parameter')
			//})
			it('should run endpoint for controller action "testPromise" that returns a promise', () => {
				return rpdef.post(baseurl + '/ctrl/promise').should.become({ x:42 })
			})
			it('should run endpoint for controller action "testExpress" that use res.send', () => {
				return rpdef.post(baseurl + '/ctrl/express').should.become("ok")
			})
			it('should run endpoint for controller action "testParam" with typed params', () => {
				return rpdef.post(baseurl + '/ctrl/params', {json: testObject}).should.become({
					body: testObjectJson,
					query: {},
					params: {}
				})
			})
			//it('should run endpoint for controller action "testParam" with a missing param', () => {
			//	return rpdef.post(baseurl + '/ctrl/params', {form: {
			//		param_number: 42,
			//		param_text: "nope"
			//	}}).should.be.rejectedWith('Missing parameter')
			//})
		})
	});
});