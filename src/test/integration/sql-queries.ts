import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { App } from '../../lib/app';
import { TemplateApp } from '../mock/template-app';

chai.config.truncateThreshold = 500;
chai.use(chaiAsPromised);
chai.should();

describe('[Sql Queries]', () => {
	let app: App;
	const tmpl = new TemplateApp('special-queries');

	before(() => {
		tmpl.beforeCreate(new_app => {
			new_app.server.disabled = true;
		});
		return tmpl.runApp().then(_app => app = _app);
	});


	it('should run default "create" to fill entity "test"', () => {
		return Promise.all([
			app.entities.get('test').getQuery('create').run({ name: 'foo', filtered: false }),
			app.entities.get('test').getQuery('create').run({ name: 'bar', filtered: true })
		]);
	});

	it('should run sql query SELECT', () => {
		return app.database.runSql(`SELECT * FROM "test"`)
			.should.become([
				{name: 'foo', filtered: 0},
				{name: 'bar', filtered: 1}
			]);
	});

});