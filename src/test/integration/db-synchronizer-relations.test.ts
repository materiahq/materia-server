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
				name: 'country',
				id: 'country-id',
				fields: [
					{
						name: 'id_country',
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
				name: 'region',
				id: 'region-id',
				fields: [
					{
						name: 'id_region',
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
				name: 'city',
				id: 'city-id',
				fields: [
					{
						name: 'id_city',
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
				name: 'test',
				id: 'test-id',
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
		).then(() =>
			app.entities.get('city').addRelation({
				type: 'belongsTo',
				field: 'id_region',
				reference: {
					entity: 'region',
					field: 'id_region'
				}
			})
		).then(() =>
			app.entities.get('region').addRelation({
				type: 'belongsTo',
				field: 'id_country',
				reference: {
					entity: 'country',
					field: 'id_country'
				}
			})
		);
	});

	describe('App', () => {

		it('should have entity country', () => {
			const field = app.entities.get('country').getField('id_country').toJson();
			field.name.should.equal('id_country');
		});

		it('country entity should have region as related entity', () => {
			const relatedEntities = app.entities.get('country').getRelatedEntities().map(entity => entity.name);
			relatedEntities.should.be.deep.equal(['region']);
		});

		it('region entity should have city and country as related entity', () => {
			const relatedEntities = app.entities.get('region').getRelatedEntities().map(entity => entity.name);
			relatedEntities.should.be.deep.equal(['city', 'country']);
		});

		it('city entity should have region as related entity', () => {
			const relatedEntities = app.entities.get('city').getRelatedEntities().map(entity => entity.name);
			relatedEntities.should.be.deep.equal(['region']);
		});

		it('city entity should have 2 fields', () => {
			const fields = app.entities.get('city').getFields().map(field => field.name);
			fields.should.be.deep.equal(['id_city', 'name', 'id_region']);
		});

		it('database and entity should be sync and not have diffs', () => {
			return app.stop()
				.then(() => {
					return app.load();
				})
				.then(() => {
					return app.start();
				})
				.then(() => {
					return app.synchronizer.diff();
				}).should.become({
					entities: [],
					fields: [],
					relations: [],
					length: 0
				});
		});

		it('app should have diffs after deleting models.json', () => {
			return fse.remove(path.join(app.path, 'server', 'models', 'country.json'))
				.then(() =>
					fse.remove(path.join(app.path, 'server', 'models', 'region.json'))
				).then(() =>
					fse.remove(path.join(app.path, 'server', 'models', 'city.json'))
				).then(() =>
					fse.remove(path.join(app.path, 'server', 'models', 'test.json'))
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
				}).then(diffs => {
					diffs.entities.should.have.deep.members([
						{
							redo: {
								table: 'country',
								type: 'create_entity',
								value: {
									fields: [
									{
										autoIncrement: true,
										default: false,
										name: 'id_country',
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
									name: 'country',
									queries: [],
									relations: []
								}
							},
							undo: {
								table: 'country',
								type: 'delete_entity'
							}
						},
						{
							redo: {
								table: 'test',
								type: 'create_entity',
								value: {
									fields: [
									{
										autoIncrement: true,
										default: false,
										name: 'id_test',
										primary: true,
										read: true,
										required: true,
										type: 'number',
										unique: true,
										write: false
									},
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
						},
						{
							redo: {
								table: 'city',
								type: 'create_entity',
								value: {
									fields: [
									{
										autoIncrement: true,
										default: false,
										name: 'id_city',
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
									name: 'city',
									queries: [],
									relations: [
										{
											field: 'id_region',
											reference: {
												entity: 'region',
												field: 'id_region'
											}
										}
									]
								}
							},
							undo: {
								table: 'city',
								type: 'delete_entity'
							}
						},
						{
							redo: {
								table: 'region',
								type: 'create_entity',
								value: {
									fields: [
									{
										autoIncrement: true,
										default: false,
										name: 'id_region',
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
									name: 'region',
									queries: [],
									relations: [
										{
											field: 'id_country',
											reference: {
												entity: 'country',
												field: 'id_country'
											}
										}
									]
								}
							},
							undo: {
								table: 'region',
								type: 'delete_entity'
							}
						}
					]);
					return diffs.length;
			}).should.become(4);
		});

		it('entities should not exists', () => {
			const entityIndex = app.entities.findAll().findIndex(entity => entity.name === 'city');
			entityIndex.should.equal(-1);
		});

		it('synchronizing should re-add entities and relations', () => {
			return app.synchronizer.diff()
				.then((diffs) =>
					app.synchronizer.databaseToEntities(diffs, null)
				).then(() => {
					return app.entities.get('city');
				}).then((entity) =>
					entity.fields.map(field => field.name)
				).should.become(['id_city', 'name', 'id_region']);
		});

		it('running default findAll query should work after sync', () => {
			return app.entities.get('city').getQuery('list').run({}, {raw: true})
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
