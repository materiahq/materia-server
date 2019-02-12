import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { join } from 'path';
import * as fse from 'fs-extra';

import { App } from '../../lib/app';
import { TemplateApp } from '../mock/template-app';

chai.config.truncateThreshold = 500;
chai.use(chaiAsPromised);
chai.should();

describe('[Relations itself]', () => {
	let app: App;
	const tmpl = new TemplateApp('empty-app');

	before(() => {
		tmpl.beforeCreate(new_app => {
			new_app.server.disabled = true;
		});
		return tmpl.runApp().then(_app => app = _app);
	});


	describe('App', () => {

		it('should create entity "test"', () => {
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
			}).then(() => app.entities.findAll().length)
			.should.become(1);
		});

		it('should add a relation test belongsTo test', () => {
			return app.entities.get('test').getQuery('delete').run({
				id_test: 1
			}).then(() => {
				return app.entities.get('test')
					.addRelation({
						type: 'belongsTo',
						field: 'id_test_2',
						reference: {
							entity: 'test',
							field: 'id_test'
						}
				}).then(() => {
					return app.entities.get('test').getRelatedEntities().map(entity => entity.name);
				}).should.become(['test']);
			});
		});

		it('should add a relation test belongsToMany test through test_has_test entity', () => {
			return app.entities.get('test').addRelation(
				{
					type: 'belongsToMany',
					through: 'test_has_test',
					reference: {
						entity: 'test',
						as: 'id_test_2'
					}
				}
			).then(() => {
				return app.entities.get('test_has_test').name;
			}).should.become('test_has_test');
		});

		it('app should have diffs after deleting test entity file and restarting app', () => {
			return fse.remove(
				join(app.path, 'server', 'models', 'test.json')
			)
			.then(() => {
				return app.stop();
			})
			.then(() => {
				return app.load();
			})
			.then(() => {
				return app.start();
			})
			.then(() => {
				return app.synchronizer.diff();
			}).then((diffs) => diffs.length === 3 && diffs.entities.length === 1 && diffs.relations.length === 2)
			.should.become(true);
		});


		it('should sync table test with belongsTo && belongsToMany itself relationships from database to entity', () => {
			return app.synchronizer.diff()
				.then((diffs) => app.synchronizer.databaseToEntities(diffs, null))
				.then(() => app.entities.get('test').name).should.become('test');
		});
	});
});