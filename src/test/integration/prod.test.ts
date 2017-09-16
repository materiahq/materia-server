import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'

import App from '../../lib/app'
import { TemplateApp } from '../mock/template-app'

chai.config.truncateThreshold = 500
chai.use(chaiAsPromised)
var should = chai.should()

describe('[Prod]', () => {
	let tpl = new TemplateApp('controller-endpoints')

	it('should load & start the application in prod mode', (done) => {
		tpl.runApp('prod')
			.then(app => app.stop())
			.then(done)
			.catch(done)
	})

	it('should run endpoint using session in production', (done) => {
		let app;
		tpl.runApp('prod')
			.then(_app => {
				app = _app;
				return tpl.get('/api/session/init')
			})
			.then(res => {
				res.should.equal('Hello World')
				return tpl.get('/api/session/fetch')
			})
			.then(res => res.should.equal("Hello World"))
			.then(() => app.stop())
			.then(() => done())
			.catch(e => done(e))
	})
})