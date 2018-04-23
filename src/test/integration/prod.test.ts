import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'

// import { App } from '../../lib/app'
import { TemplateApp } from '../mock/template-app'

chai.config.truncateThreshold = 500
chai.use(chaiAsPromised)
chai.should()

describe('[Prod]', () => {
	let tpl = new TemplateApp('controller-endpoints')

	let app;

	before(() => {
		return tpl.runApp().then(_app => app = _app)
	})

	after(() => {
		return app.stop()
	})

	it('should run endpoint using session in production', (done) => {
		tpl.get('/api/session/init')
			.then(res => {
				console.log('init', res)
				res.should.equal('Hello World')
				return tpl.get('/api/session/fetch')
			}).then(res => {
				res.should.equal('Hello World')
				done()
			}).catch(e => {
				done(e)
			})
	})
})