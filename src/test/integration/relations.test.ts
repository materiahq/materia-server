import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'

import { App } from '../../lib/app'
import { TemplateApp } from '../mock/template-app'

chai.config.truncateThreshold = 500
chai.use(chaiAsPromised)
chai.should()

describe('[Relations]', () => {
	let app: App
	let tmpl = new TemplateApp('empty-app')

	before(() => {
		tmpl.beforeCreate(new_app => {
			new_app.server.disabled = true
		})
		return tmpl.runApp().then(_app => app = _app)
	})


	describe('App', () => {

		it('should prepare entities "test" and "test2', () => {
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
			}).then(() => app.entities.add({
				name: "test2",
				id: "fake-id-2",
				fields: [
					{
						name: "id_test2",
						type: "number",
						read: true,
						write: false,
						primary: true,
						unique: true,
						required: true,
						autoIncrement: true,
						component: "input"
					},
					{
						name: "t2_data",
						type: "text",
						read: true,
						write: true,
						primary: false,
						unique: false,
						required: false,
						component: "input"
					}
				]
			})).then(() => app.entities.get('test').getQuery('create').run())
			.then(() => app.entities.get('test2').getQuery('create').run({ t2_data: 'foo' }))
			.then(() => app.entities.get('test2').getQuery('get').run({ id_test2: 1 }, { raw:true }))
			.should.become({ id_test2: 1, t2_data: 'foo' })
		})

		it('should add a relation test belongsTo test2 and receive all values', () => {
			return app.entities.get('test').addRelation({
				type: 'belongsTo',
				field: 'id_test2',
				reference: {
					entity: 'test2',
					field: 'id_test2'
				}
			}).then(() => {
				return app.entities.get('test').addQuery({
					id: 'getAll',
					type: 'findAll',
					opts: {
						include: [
							{
								entity: 'test2',
								fields: ['t2_data']
							}
						]
					}
				})
			}).then(() => app.entities.get('test').getQuery('getAll').run())
			.then(data => data.toJSON())
			.should.become({
				count: 1,
				data: [
					{
						id_test: 1,
						id_test2: 1,
						test2: {
							t2_data: 'foo'
						}
					}
				]
			})
		})

		it('should add a relation test belongsTo test2 and receive one value', () => {
			app.entities.get('test').addQuery({
				id: 'getOne',
				type: 'findOne',
				opts: {
					include: [
						{
							entity: 'test2',
							fields: ['t2_data']
						}
					]
				}
			})
			return app.entities
				.get('test')
				.getQuery('getOne')
				.run({ id_test: 1 })
				.then(data => {
					data.toJSON().should.deep.equal({
						id_test: 1,
						id_test2: 1,
						test2: {
							t2_data: 'foo'
						}
					})
				})
		})

		it('should remove the last relation', done => {
			app.entities.get('test').removeRelation({
				field: 'id_test2',
				reference: {
					entity: 'test2',
					field: 'id_test2'
				}
			})
			.then(() =>
				app.entities.get('test').getQuery('get').run({ id_test: 1 })
			)
			.then(data => {
				data.toJSON().should.deep.equal({
					id_test: 1
				})
				app.entities.get('test').removeQuery('getOne')
				done()
			}).catch(e => done(e))
		})

		it('should add a relation test belongsTo test2 without data and create / receive one value', () => {
			let created_id_test, created_id_test2

			return app.entities.get('test').getQuery('delete').run({
				id_test: 1
			})
			.then(() =>
				app.entities.get('test2').getQuery('delete').run({ id_test2: 1 })
			)
			.then(() =>
				app.entities.get('test').addRelation({
					type: 'belongsTo',
					field: 'id_test2',
					reference: {
						entity: 'test2',
						field: 'id_test2'
					}
				})
			)
			.then(() =>
				app.entities.get('test').addQuery({
					id: 'getOne',
					type: 'findOne',
					opts: {
						include: [
							{
								entity: 'test2',
								fields: ['t2_data']
							}
						]
					}
				})
			)
			.then(() =>
				app.entities.get('test2').getQuery('create').run({ t2_data: 'bar' }, {raw: true})
			)
			.then(added => {
				created_id_test2 = added.id_test2
				return app.entities.get('test').getQuery('create').run({ id_test2: added.id_test2 }, {raw: true})
			})
			.then(added => {
				created_id_test = added.id_test
				return app.entities.get('test').getQuery('getOne').run({ id_test: added.id_test })
			})
			.then(data => {
				data.toJSON().should.deep.equal({
					id_test: created_id_test,
					id_test2: created_id_test2,
					test2: {
						t2_data: 'bar'
					}
				})
			})
		})
	})
})