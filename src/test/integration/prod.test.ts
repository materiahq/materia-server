import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { TemplateApp } from '../mock/template-app';
import { App } from '../../lib';

chai.config.truncateThreshold = 500;
chai.use(chaiAsPromised);
chai.should();

describe('[Prod]', () => {
	const tpl = new TemplateApp('controller-endpoints');
	let app: App;

	before(() => {
		return tpl.runApp().then(_app => app = _app);
	});

	after(() => {
		return app.stop();
	});

	it('should run endpoint using session in production', (done) => {
		tpl.get('/api/session/init')
			.then(res => {
				res.should.equal('Hello World');
				return tpl.get('/api/session/fetch');
			}).then(res => {
				res.should.equal('Hello World');
				done();
			}).catch(e => {
				done(e);
			});
	});
});