import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { TemplateApp } from '../mock/template-app';

chai.config.truncateThreshold = 500;
chai.use(chaiAsPromised);
chai.should();

describe('[App]', () => {
	const tpl = new TemplateApp('controller-endpoints');

	it('should load & start the application in dev mode', (done) => {
		tpl.runApp('dev')
			.then(app => app.stop())
			.then(done)
			.catch(done);
	});
});