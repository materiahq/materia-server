import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'

import { App } from '../../lib/app'
import { TemplateApp } from '../mock/template-app'

chai.config.truncateThreshold = 500
chai.use(chaiAsPromised)
chai.should()

describe('[Special Queries]', () => {
	let app: App
	let tmpl = new TemplateApp('special-queries')

	before(() => {
		tmpl.beforeCreate(new_app => {
			new_app.server.disabled = true
		})
		return tmpl.runApp().then(_app => app = _app)
	})


	describe('App', () => {
		describe('Queries', () => {
			it('should run default "create" to fill entity "test"', () => {
				return Promise.all([
					app.entities.get('test').getQuery('create').run({ name:"foo", filtered: false }),
					app.entities.get('test').getQuery('create').run({ name:"bar", filtered: true })
				])
			})
			it('should run default "get" to check types', () => {
				return Promise.all([
					app.entities.get('test').getQuery('get').run({
						name: "foo"
					}, {raw: true}),
					app.entities.get('test').getQuery('get').run({
						name: "bar"
					}, {raw: true})
				]).should.become([{
					name: "foo",
					filtered: tmpl.dbBoolean(false)
				},{
					name: "bar",
					filtered: tmpl.dbBoolean(true)
				}])
			})
			it('should check query "listFilteredBoolValue"', () => {
				return app.entities.get('test').getQuery('listFilteredBoolValue').run(null, { raw: true }).then(res => {
					res.count.should.equal(1)
					res.data.should.deep.equal([{
							name: "bar",
							filtered: tmpl.dbBoolean(true)
						}
					])
				})
			})
		})
	});
});