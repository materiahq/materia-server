import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fse from 'fs-extra';
import * as path from 'path';

import { App } from '../../lib/app';
import { TemplateApp } from '../mock/template-app';

chai.config.truncateThreshold = 500;
chai.use(chaiAsPromised);
chai.should();

describe('[Database synchronizer]', () => {
	let app: App;
	const tmpl = new TemplateApp('empty-app');
	const primaryFieldDefault = {
		autoIncrement: true,
		primary: true,
		read: true,
		required: true,
		type: 'number',
		unique: true,
		write: false
	};

	before(() => {
		tmpl.beforeCreate(new_app => {
			new_app.server.disabled = true;
		});
		return tmpl.runApp().then(_app => (app = _app));
	});

	describe('App', () => {
		it('should prepare entities "test"', () => {
			return app.entities
				.add({
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
				})
				.then(() =>
					app.entities
						.get('test')
						.getField('id_test').toJson()
				)
				.should.become({
					name: 'id_test',
					component: 'input',
					...primaryFieldDefault
				});
		});

		it('Database should have empty diffs', () => {
			return app.synchronizer
				.diff()
				.should.become({
					entities: [],
					fields: [],
					relations: [],
					length: 0
				});
		});

		it('Database should have diffs', () => {
			return fse
				.remove(
					path.join(app.path, 'server', 'models', 'test.json')
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
				})
				.should.become({
					entities: [
						{
							redo: {
								table: 'test',
								type: 'create_entity',
								value: {
									fields: [
										{
											name: 'id_test',
											default: false,
											...primaryFieldDefault
										}
									],
									isRelation: undefined,
									name: 'test',
									queries: [],
									relations: []
								}
							},
							undo: {
								table: 'test',
								type: 'delete_entity'
							}
						}
					],
					fields: [],
					relations: [],
					length: 1
				});
		});

		it('Synchronizing should re-add test model file with same intial property', () => {
			return app.synchronizer.diff()
			.then((diffs) => {
				return app.synchronizer.databaseToEntities(diffs, null);
			}).then(() => {
				return app.entities.findAll();
			}).then(() => {
				return app.entities.get('test').getField('id_test').toJson();
			}).should.become({
				name: 'id_test',
				component: 'input',
				...primaryFieldDefault
			});
		});
	});
});
