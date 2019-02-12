import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { App } from '../../lib/app';
import { TemplateApp } from '../mock/template-app';

chai.config.truncateThreshold = 500;
chai.use(chaiAsPromised);
chai.should();

describe('[Relations without "onDelete: CASCADE"]', () => {
	let app: App;
	let tmpl = new TemplateApp('empty-app');

	before(() => {
		tmpl.beforeCreate(new_app => {
			new_app.server.disabled = true;
		})
		return tmpl.runApp().then(_app => app = _app);
	})


	describe('App', () => {

		it('should prepare entities "test" and "test2', () => {
			return app.entities.add({
				name: "test",
				id: "fake-id",
				fields: [
					{
						name: "id_test",
						type: "number",
						read: true,
						write: false,
						primary: true,
						unique: true,
						required: true,
						autoIncrement: true,
						component: "input"
					}
				]
			}).then(() => app.entities.add({
				name: "test2",
				id: "fake-id-2",
				fields: [
					{
						name: "id_test2",
						type: "number",
						read: true,
						write: false,
						primary: true,
						unique: true,
						required: true,
						autoIncrement: true,
						component: "input"
					},
					{
						name: "t2_data",
						type: "text",
						read: true,
						write: true,
						primary: false,
						unique: false,
						required: false,
						component: "input"
					}
				]
			}))
			.then(() => app.entities.get('test2').getQuery('create').run({ t2_data: 'foo' }))
			.then(() => app.entities.get('test2').getQuery('get').run({ id_test2: 1 }, { raw:true }))
			.should.become({ id_test2: 1, t2_data: 'foo' })
		})

		it('should add a relation test hasMany test2 even if test2 not empty', () => {
			return app.entities.get('test2').addRelation({
				type: 'belongsTo',
				field: 'id_test',
				unique: true,
				reference: {
					entity: 'test',
					field: 'id_test'
				}
			}).then(() => {
				return app.entities.get('test').addQuery({
					id: 'getAll',
					type: 'findAll',
					opts: {
						include: [
							{
								entity: 'test2',
								fields: ['t2_data']
							}
						]
					}
				})
			}).then(() => app.entities.get('test').getRelatedEntities().map(entity => entity.name))
			.should.become(['test2'])
		})


		it('data in test2 should have null value for fk id_test', () => {
			return app.entities.get('test2').getQuery('list').run(null, {raw: true})
			.should.become(
				{count: 1,
				data: [
					{
						id_test2: 1,
						t2_data: 'foo',
						id_test: null
					}
				]}
			)
		});

		it('should add query with join and run successfully', () => {
			return app.entities.get('test').addQuery({
				id: 'getAll',
				type: 'findAll',
				opts: {
					include: [
						{
							entity: 'test2',
							fields: ['t2_data']
						}
					]
				}
			})
			.then(() => app.entities.get('test').getQuery('getAll').run())
			.then(data => data.toJSON())
			.should.become({
				count: 0,
				data: []
			})
		})

		it('entities and database should have no diffs', () => {
			return app.synchronizer.diff()
				.then(diffs => {
					return diffs.length
				}).should.become(0)
		});
	})
})