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
	let tmpl = new TemplateApp('empty-app')

	before(() => {
		tmpl.beforeCreate(new_app => {
			new_app.server.disabled = true
		})
		return tmpl.runApp().then(_app => app = _app)
	})


	describe('App', () => {

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
				write: true,
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
				write: true,
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
		it('should delete field "foo2"', () => {
			return app.entities.get("test").removeField("foo2").then(() => {
				should.not.exist(app.entities.get('test').getField("foo2"))
				return app.entities.get('test').getQuery('get').run({ id_test: 1 }, { raw: true }).should.become({
					id_test: 1,
					foo: "bar",
				})
			})
		})
		if ( ! process.env.TRAVIS ) {
			it('should not update field "foo" to a unique field', () => {
				return app.entities.get("test").updateField("foo", { unique:true }).should.be.rejectedWith('Validation error')
			})
			it('should update field "foo" to a unique field', () => {
				let fieldjson = {
					name: "foo",
					type: "text",
					unique: true,
					read: true,
					write: true,
					default: true,
					defaultValue: "bar",
					component: "input"
				}
				return app.entities.get('test').getQuery('delete').run({ id_test: 2 }).then(() => {
					return app.entities.get("test").updateField("foo", { unique:true })
				}).then(field => {
					should.exist(field)
					field.toJson().should.deep.equal(fieldjson)
					return app.entities.get('test').getQuery('create').run().should.be.rejectedWith('Validation error')
				}).then(() => {
					return app.entities.get('test').getQuery('create').run({
						foo: "bar2"
					}).should.be.fulfilled
				}).then((field) => {
					should.exist(field)
					return app.entities.get('test').getQuery('delete').run({ id_test: field.id_test })
				}).then((count) => {
					should.equal(count, 1)
				})
			})
			it('should add a unique field "foo2" and make a unique group with "foo"', () => {
				let fieldjson = {
					name: "foo",
					type: "text",
					unique: "uniq_foo",
					read: true,
					write: true,
					default: true,
					defaultValue: "bar",
					component: "input"
				}
				let fieldjson2 = {
					name: "foo2",
					type: "text",
					unique: "uniq_foo",
					read: true,
					write: true,
					default: true,
					defaultValue: "bar",
					component: "input"
				}
				return app.entities.get("test").addField(fieldjson2).should.be.fulfilled.then(field2 => {
					should.exist(field2)
					field2.toJson().should.deep.equal(fieldjson2)
					return app.entities.get("test").updateField("foo", { unique: "uniq_foo" }).should.be.fulfilled
				}).then(field => {
					should.exist(field)
					field.toJson().should.deep.equal(fieldjson)
					return app.entities.get('test').getQuery('create').run({
						foo: "bar2",
						foo2: "bar3"
					}).should.be.fulfilled
				}).then(() => {
					return app.entities.get('test').getQuery('create').run({
						foo: "bar2",
						foo2: "bar4"
					}).should.be.fulfilled
				}).then(() => {
					return app.entities.get('test').getQuery('create').run({
						foo: "bar2",
						foo2: "bar3"
					}).should.be.rejectedWith('Validation error')
				})
			})
		}
	});
});