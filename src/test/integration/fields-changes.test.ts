import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'

import App from '../../lib/app'
import MateriaError from '../../lib/app'
import { TemplateApp } from '../mock/template-app'

chai.config.truncateThreshold = 500
chai.use(chaiAsPromised)
const should = chai.should()

describe('[Fields]', () => {
	let app: App

	before(() => {
		let tmpl = new TemplateApp('empty-app')

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

		it('should prepare an entity "test" with data', () => {
			return app.entities.add({
				name: "test",
				id: "fake-id",
				fields: [
					{
						name: "id_test",
						type: "number",
						read: true,
						write: false,
						primary: true,
						unique: true,
						required: true,
						autoIncrement: true,
						component: "input"
					}
				]
			}).then(() => app.entities.get('test').getQuery('create').run()
			).then(() => app.entities.get('test').getQuery('get').run({ id_test: 1 }, { raw:true })
			).should.become({ id_test: 1 })
		})
		it('should add a text field "foo" with default value "bar"', () => {
			let fieldjson = {
				name: "foo",
				type: "text",
				read: true,
				write: false,
				default: true,
				defaultValue: "bar",
				component: "input"
			}
			return app.entities.get("test").addField(fieldjson).then(field => {
				should.exist(field)
				field.toJson().should.deep.equal(fieldjson)
				should.exist(app.entities.get("test").getField("foo"))
				app.entities.get("test").getField("foo").toJson().should.deep.equal(fieldjson)
				return app.entities.get('test').getQuery('create').run()
			}).then(() => {
				return Promise.all([
					app.entities.get('test').getQuery('get').run({ id_test: 1 }, { raw: true }).should.become({
						id_test: 1,
						foo: "bar"
					}),
					app.entities.get('test').getQuery('get').run({ id_test: 2 }, { raw: true }).should.become({
						id_test: 2,
						foo: "bar"
					})
				])
			})
		})
		it('should add a required text field "foo2" with an init value "bar2"', () => {
			let fieldjson = {
				name: "foo2",
				type: "text",
				read: true,
				write: false,
				required: true,
				default: false,
				defaultValue: "bar2",
				component: "input"
			}
			return app.entities.get("test").addField(fieldjson).then(field => {
				should.exist(field)
				//field.toJson().should.deep.equal(fieldjson)
				should.exist(app.entities.get("test").getField("foo2"))
				//app.entities.get("test").getField("foo2").toJson().should.deep.equal(fieldjson)
				return app.entities.get('test').getQuery('get').run({ id_test: 1 }, { raw: true }).should.become({
					id_test: 1,
					foo: "bar",
					foo2: "bar2"
				})
			}).then(() => {
				//return app.entities.get('test').getQuery('create').run().should.be.rejectedWith('Missing required parameter')
				// TODO actual is .rejectedWith('foo2 cannot be null') but it should refresh the query parameters when adding the field.
			})
		})
	});
});