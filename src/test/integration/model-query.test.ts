import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'

import App from '../../lib/app'
import MateriaError from '../../lib/app'
import { TemplateApp } from '../mock/template-app'

chai.use(chaiAsPromised)
chai.should()

describe('[Model Queries]', () => {
	let app: App
	let testObject = {
		param_number: 42,
		param_text: "foo",
		param_float: 0.5,
		param_date: new Date(10),
		bool_false: false,
		bool_true: true
	}

	before(() => {
		let tmpl = new TemplateApp('model-queries')

		app = tmpl.createInstance()
		app.server.disabled = true
	})


	describe('App', () => {
		it('should load', () => {
			return app.load().should.be.fulfilled
		});
		it('should start', () => {
			return app.start().should.be.fulfilled
		});

		describe('Queries', () => {
			it('should run default "create", 4 times', () => {
				return Promise.all([
					app.entities.get('test').getQuery('create').run(),
					app.entities.get('test').getQuery('create').run(),
					app.entities.get('test').getQuery('create').run(),
					app.entities.get('test').getQuery('create').run()
				])
			})
			it('should run default "get"', () => {
				return app.entities.get('test').getQuery('get').run({
					id_test: 2
				}, {raw: true}).should.become({
					id_test: 2
				})
			})
			it('should run default "update"', () => {
				return app.entities.get('test').getQuery('update').run({
					id_test: 2,
					new_id_test: 42
				})
			})
			it('should not run default "delete" with missing parameter', () => {
				return app.entities.get('test').getQuery('delete').run().should.be.rejectedWith('Missing required parameter')
			})
			it('should run default "delete"', () => {
				return app.entities.get('test').getQuery('delete').run({
					id_test: 3
				})
			})
			it('should run default "list"', () => {
				return app.entities.get('test').getQuery('list').run(null, {raw: true}).should.become({
					count:3,
					rows:[
						{ id_test:1 },
						{ id_test:4 },
						{ id_test:42 },
					]
				})
			})
			it('should run model action "testRaw" that returns an object', () => {
				return app.entities.get('test').getQuery('testRaw').run().should.become(testObject)
			})
			it('should run model action "testPromise" that returns a promise', () => {
				return app.entities.get('test').getQuery('testPromise').run().should.become(testObject)
			})
			it('should run model action "testParam" that returns the params', () => {
				return app.entities.get('test').getQuery('testParam').run(testObject).should.become(testObject)
			})
			it('should not run model action "testParam" with a missing param', () => {
				return app.entities.get('test').getQuery('testParam').run({
					param_number: 42,
					param_text: "nope"
				}).should.be.rejectedWith('Missing required parameter')
			})
			it('should run model action "testConstructor" that returns the entity name and app name', () => {
				return app.entities.get('test').getQuery('testConstructor').run().should.become({
					app_name: 'model-queries',
					entity_name: 'test'
				})
			})
		})
	});
});