import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fse from 'fs-extra';

import { App } from '../../lib/app';
import { TemplateApp } from '../mock/template-app';

chai.config.truncateThreshold = 500;
chai.use(chaiAsPromised);
const should = chai.should();

describe('[Renaming tests]', () => {
	let app: App;
	const tmpl = new TemplateApp('empty-app');

	before(() => {
		tmpl.beforeCreate(new_app => {
			new_app.server.disabled = true;
		});
		return tmpl.runApp().then(_app => app = _app);
	});

	it('should prepare entities "test" and "test2"', () => {
		return app.entities.add({
			name: 'test',
			id: 'fake-id',
			fields: [
				{
					name: 'id_test',
					type: 'number',
					read: true,
					write: false,
					primary: true,
					unique: true,
					required: true,
					autoIncrement: true,
					component: 'input'
				}
			]
		}).then(() => app.entities.add({
			name: 'test2',
			id: 'fake-id-2',
			fields: [
				{
					name: 'id_test2',
					type: 'number',
					read: true,
					write: false,
					primary: true,
					unique: true,
					required: true,
					autoIncrement: true,
					component: 'input'
				},
				{
					name: 'text_test2',
					type: 'text',
					read: true,
					write: true,
					default: true,
					defaultValue: 'anything',
					component: 'input'
				}
			]
		})).then(() => app.entities.get('test').getQuery('create').run()
		).then(() => app.entities.get('test2').getQuery('create').run()
		).then(() => app.entities.get('test').getQuery('get').run({ id_test: 1 }, { raw: true })
		).should.become({ id_test: 1 });
	});

	it('should rename test -> test3 when app is stopped', () => {
		return tmpl.resetApp(app, () => {
			fse.renameSync(app.path + '/server/models/test.json', app.path + '/server/models/test3.json');
		}).then(_app => app = _app)
		.then(() => {
			should.not.exist(app.entities.get('test'));
			should.exist(app.entities.get('test3'));
			return app.entities.get('test3').getQuery('get').run({ id_test: 1 }, { raw: true }).should.become({ id_test: 1 });
		});
	});

	it('should rename test3 -> test when app is running', () => {
		return app.entities.rename('test3', 'test')
		.then(() => {
			should.not.exist(app.entities.get('test3'));
			should.exist(app.entities.get('test'));
			return app.entities.get('test').getQuery('get').run({ id_test: 1 }, { raw: true }).should.become({ id_test: 1 });
		});
	});

	it('should add a relation test belongs to test2, and a query to fetch both', () => {
		return app.entities.get('test').addRelation({
			type: 'belongsTo',
			field: 'id_test2',
			reference: {
				entity: 'test2',
				field: 'id_test2'
			}
		}).then(() => {
			return app.entities.get('test').getQuery('get').run({ id_test: 1 }, { raw: true }).should.become({ id_test: 1, id_test2: 1 });
		}).then(() => {
			app.entities.get('test').addQuery({
				id: 'both',
				type: 'findOne',
				opts: {
					select: [
						'id_test'
					],
					include: [
						{
							entity: 'test2',
							fields: [
								'id_test2',
								'text_test2'
							]
						}
					],
					conditions: [
						{
							name: 'id_test',
							operator: '=',
							value: '='
						}
					]
				},
			});
			return app.entities.get('test').getQuery('both').run({ id_test: 1 }).then(data => data.toJSON()).should.become({
				id_test: 1,
				test2: {
					id_test2: 1,
					text_test2: 'anything'
				}
			});
		});
	});

	it('should rename test -> test3 when app is stopped and keep ref to test2', () => {
		return tmpl.resetApp(app, () => {
			fse.renameSync(app.path + '/server/models/test.json', app.path + '/server/models/test3.json');
		}).then(_app => app = _app)
		.then(() => {
			should.not.exist(app.entities.get('test'));
			should.exist(app.entities.get('test3'));
			return app.entities.get('test3').getQuery('both').run({ id_test: 1 }).then(data => data.toJSON()).should.become({
				id_test: 1,
				test2: {
					id_test2: 1,
					text_test2: 'anything'
				}
			});
		});
	});

	it('should rename test3 -> test when app is running and keep ref to test2', () => {
		return app.entities.rename('test3', 'test')
		.then(() => {
			should.not.exist(app.entities.get('test3'));
			should.exist(app.entities.get('test'));
			return app.entities.get('test').getQuery('both').run({ id_test: 1 }).then(data => data.toJSON()).should.become({
				id_test: 1,
				test2: {
					id_test2: 1,
					text_test2: 'anything'
				}
			});
		});
	});
});
