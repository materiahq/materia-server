import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'

import App from '../../lib/app'
import { TemplateApp } from '../mock/template-app'

chai.config.truncateThreshold = 500
chai.use(chaiAsPromised)
var should = chai.should()

describe('[App]', () => {
	let tpl = new TemplateApp('controller-endpoints')

	describe('App', () => {
		it('should load & start the application in dev mode', (done) => {
			tpl.runApp('dev')
				.then(app => app.stop())
				.then(done)
				.catch(done)
		})
	})
})