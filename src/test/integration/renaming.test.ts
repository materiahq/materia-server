import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import * as fse from 'fs-extra'

import App from '../../lib/app'
import MateriaError from '../../lib/app'

import { TemplateApp } from '../mock/template-app'

chai.config.truncateThreshold = 500
chai.use(chaiAsPromised)
const should = chai.should()

describe('[Renaming tests]', () => {
	let app: App
	let tmpl = new TemplateApp('empty-app')

	before(() => {
		tmpl.beforeCreate(new_app => {
			new_app.server.disabled = true
		})
		return tmpl.runApp().then(_app => app = _app)
	})


	describe('App', () => {

		it('should prepare entities "test" and "test2"', () => {
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
					}
				]
			})).then(() => app.entities.get('test').getQuery('create').run()
			).then(() => app.entities.get('test2').getQuery('create').run()
			).then(() => app.entities.get('test').getQuery('get').run({ id_test: 1 }, { raw:true })
			).should.become({ id_test: 1 })
		});

		//it('should rename test -> test3 when app is stopped', () => {
		//	return tmpl.resetApp(app, (new_app) => {
		//		fse.renameSync(app.path + '/server/models/test.json', app.path + '/server/models/test3.json')
		//	}).then(_app => app = _app)
		//	.then(() => {
		//		should.not.exist(app.entities.get('test'))
		//		should.exist(app.entities.get('test3'))
		//		return app.entities.get('test3').getQuery('get').run({ id_test: 1 }, { raw:true }).should.become({ id_test: 1 })
		//	})
		//});
	});
});