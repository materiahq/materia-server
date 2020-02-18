import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { App } from '../../lib/app';
import { TemplateApp } from '../mock/template-app';

chai.config.truncateThreshold = 500;
chai.use(chaiAsPromised);
chai.should();

describe('[Endpoints middlewares]', () => {
	let app: App;
	const tpl = new TemplateApp('endpoints-permissions');

	before(() => {
		return tpl.runApp().then(_app => app = _app);
	});

	after(() => {
		return app.stop();
	});


	it('should run endpoint with two middlewares 2 times', () => {
		const run = () => {
			return tpl.post('/api/ctrl/permissions', {data: 'any'});
		};
		return Promise.all([run(), run()]).should.become([
			{
				data: 'any',
				message: 'Hello World!'
			},
			{
				data: 'any',
				message: 'Hello World!'
			}
		]);
	});
});