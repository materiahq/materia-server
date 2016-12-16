import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'

import App from '../../lib/app'
import MateriaError from '../../lib/app'
import { TemplateApp } from '../mock/template-app'

chai.config.truncateThreshold = 500
chai.use(chaiAsPromised)
const should = chai.should()

describe('[Entities]', () => {
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

		it('should create a simple entity "test"', () => {
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
			}).then((entity) => {
				should.exist(app.entities.get('test'))
				app.entities.get('test').toJson().should.deep.equal({
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
					],
					relations: [],
					queries: []
				})
			}).should.be.fulfilled
		})
		it('should run default "create" and "get"', () => {
			return app.entities.get('test').getQuery('create').run().then(() => {
				return app.entities.get('test').getQuery('get').run({ id_test: 1 }, { raw:true })
			}).should.become({ id_test: 1 })
		})
		it('should rename entity "test" to "test2', () => {
			return app.entities.rename("test", "test2").then(() => {
				should.not.exist(app.entities.get("test"))
				should.exist(app.entities.get("test2"))
			}).should.be.fulfilled
		})
		it('should keep data after rename', () => {
			return app.entities.get('test2').getQuery('get').run({ id_test: 1 }, { raw:true }).should.be.fulfilled
		})
		it('should delete entity "test2"', () => {
			return app.entities.remove("test2").then(() => {
				should.not.exist(app.entities.get("test2"))
			}).should.be.fulfilled
		})
	});
});