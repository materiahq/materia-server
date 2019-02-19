import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fse from 'fs-extra';
import * as path from 'path';

import { App } from '../../lib/app';
import { TemplateApp } from '../mock/template-app';

chai.config.truncateThreshold = 500;
chai.use(chaiAsPromised);
chai.should();

describe('[Database synchronizer with relations]', () => {
	let app: App;
	const tmpl = new TemplateApp('empty-app');

	before(() => {
		tmpl.beforeCreate(new_app => {
			new_app.server.disabled = true;
		});
		return tmpl.runApp().then(_app => (app = _app))
		.then(() =>
			app.entities.add({
				name: 'sayan',
				id: 'sayan-id',
				fields: [
					{
						name: 'id_sayan',
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
						name: 'name',
						type: 'text',
						read: true,
						write: true,
						unique: false,
						required: false,
						component: 'input'
					}
				]
			})
		).then(() =>
			app.entities.add({
				name: 'power',
				id: 'power-id',
				fields: [
					{
						name: 'id_power',
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
						name: 'name',
						type: 'text',
						read: true,
						write: true,
						unique: false,
						required: false,
						component: 'input'
					}
				]
			})
		).then(() =>
			app.entities.add({
				name: 'subpower',
				id: 'subpower-id',
				fields: [
					{
						name: 'id_subpower',
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
						name: 'name',
						type: 'text',
						read: true,
						write: true,
						unique: false,
						required: false,
						component: 'input'
					}
				]
			})
		).then(() =>
			app.entities.add({
				name: 'gorille',
				id: 'gorille-id',
				fields: [
					{
						name: 'id_gorille',
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
		).then(() =>
			app.entities.get('subpower').addRelation({
				type: 'belongsTo',
				field: 'id_power',
				reference: {
					entity: 'power',
					field: 'id_power'
				}
			})
		).then(() =>
			app.entities.get('power').addRelation({
				type: 'belongsTo',
				field: 'id_sayan',
				reference: {
					entity: 'sayan',
					field: 'id_sayan'
				}
			})
		);
	});

	describe('App', () => {

		it('should have entity sayan', () => {
			const field = app.entities.get('sayan').getField('id_sayan').toJson();
			field.name.should.equal('id_sayan');
		});

		it('sayan should have power as related entity', () => {
			const relatedEntities = app.entities.get('sayan').getRelatedEntities().map(entity => entity.name);
			relatedEntities.should.be.deep.equal(['power']);
		});


		it('power should have subpower and sayan as related entity', () => {
			const relatedEntities = app.entities.get('power').getRelatedEntities().map(entity => entity.name);
			relatedEntities.should.be.deep.equal(['subpower', 'sayan']);
		});

		it('subpower should have power as related entity', () => {
			const relatedEntities = app.entities.get('subpower').getRelatedEntities().map(entity => entity.name);
			relatedEntities.should.be.deep.equal(['power']);
		});

		it('subpower should have 2 fields', () => {
			const fields = app.entities.get('subpower').getFields().map(field => field.name);
			fields.should.be.deep.equal(['id_subpower', 'name', 'id_power']);
		});

		it('App should have diffs after deleting models.json', () => {
			return fse.remove(path.join(app.path, 'server', 'models', 'sayan.json'))
				.then(() =>
					fse.remove(path.join(app.path, 'server', 'models', 'power.json'))
				).then(() =>
					fse.remove(path.join(app.path, 'server', 'models', 'subpower.json'))
				).then(() =>
					fse.remove(path.join(app.path, 'server', 'models', 'gorille.json'))
				).then(() => {
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
				}).should.become({
					entities:
					[
						{
							redo: {
								table: 'sayan',
								type: 'create_entity',
								value: {
									fields: [
									{
										autoIncrement: true,
										default: false,
										name: 'id_sayan',
										primary: true,
										read: true,
										required: true,
										type: 'number',
										unique: true,
										write: false
									},
									{
										autoIncrement: false,
										default: false,
										name: 'name',
										primary: false,
										read: true,
										required: false,
										type: 'text',
										unique: false,
										write: true
									}
									],
									isRelation: undefined,
									name: 'sayan',
									queries: [],
									relations: []
								}
							},
							undo: {
								table: 'sayan',
								type: 'delete_entity'
							}
						},
						{
							redo: {
								table: 'gorille',
								type: 'create_entity',
								value: {
									fields: [
									{
										autoIncrement: true,
										default: false,
										name: 'id_gorille',
										primary: true,
										read: true,
										required: true,
										type: 'number',
										unique: true,
										write: false
									},
									],
									isRelation: undefined,
									name: 'gorille',
									queries: [],
									relations: []
								}
							},
							undo: {
								table: 'gorille',
								type: 'delete_entity'
							}
						},
						{
							redo: {
								table: 'subpower',
								type: 'create_entity',
								value: {
									fields: [
									{
										autoIncrement: true,
										default: false,
										name: 'id_subpower',
										primary: true,
										read: true,
										required: true,
										type: 'number',
										unique: true,
										write: false
									},
									{
										autoIncrement: false,
										default: false,
										name: 'name',
										primary: false,
										read: true,
										required: false,
										type: 'text',
										unique: false,
										write: true
									}
									],
									isRelation: undefined,
									name: 'subpower',
									queries: [],
									relations: [
										{
											field: 'id_power',
											reference: {
												entity: 'power',
												field: 'id_power'
											}
										}
									]
								}
							},
							undo: {
								table: 'subpower',
								type: 'delete_entity'
							}
						},
						{
							redo: {
								table: 'power',
								type: 'create_entity',
								value: {
									fields: [
									{
										autoIncrement: true,
										default: false,
										name: 'id_power',
										primary: true,
										read: true,
										required: true,
										type: 'number',
										unique: true,
										write: false
									},
									{
										autoIncrement: false,
										default: false,
										name: 'name',
										primary: false,
										read: true,
										required: false,
										type: 'text',
										unique: false,
										write: true
									}
									],
									isRelation: undefined,
									name: 'power',
									queries: [],
									relations: [
										{
											field: 'id_sayan',
											reference: {
												entity: 'sayan',
												field: 'id_sayan'
											}
										}
									]
								}
							},
							undo: {
								table: 'power',
								type: 'delete_entity'
							}
						}
					],
					fields: [],
					relations: [],
					length: 4
				});
		});


		it('Entities should not exists', () => {
			const entityIndex = app.entities.findAll().findIndex(entity => entity.name === 'subpower');
			entityIndex.should.equal(-1);
		});

		it('Synchronizing should re-add entities and relations', () => {
			return app.synchronizer.diff()
				.then((diffs) =>
					app.synchronizer.databaseToEntities(diffs, null)
				).then(() => {
					return app.entities.get('subpower');
				}).then((entity) =>
					entity.fields.map(field => field.name)
				).should.become(['id_subpower', 'name', 'id_power']);
		});

		it('Running default findAll query should work after sync', () => {
			return app.entities.get('subpower').getQuery('list').run({}, {raw: true})
				.should.become({
					count: 0,
					pagination: {
						limit: 30,
						offset: 0,
						page: 1
					},
					data: []
				});
		});
	});
});
