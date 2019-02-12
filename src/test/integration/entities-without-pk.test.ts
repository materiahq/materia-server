import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { App } from '../../lib/app';
import { TemplateApp } from '../mock/template-app';

chai.config.truncateThreshold = 500;
chai.use(chaiAsPromised);
const should = chai.should();

describe('[Entities without primary field]', () => {
	let app: App;
	let tmpl = new TemplateApp('empty-app');

	before(() => {
		tmpl.beforeCreate(new_app => {
			new_app.server.disabled = true;
		})
		return tmpl.runApp().then(_app => app = _app);
	})


	describe('App', () => {

		it('should create a simple entity "test"', () => {
			return app.entities.add({
				name: "test",
				id: "fake-id",
				fields: [
					{
						name: "test",
						type: "text",
						read: true,
						component: "input"
					}
				]
			}).then(() => {
				should.exist(app.entities.get('test'));
				app.entities.get('test').toJson().should.deep.equal({
					id: "fake-id",
					x: undefined,
					y: undefined,
					fields: [
						{
							name: "test",
							type: "text",
							read: true,
							write: true,
							component: "input"
						}
					],
					relations: [],
					queries: []
				});
			}).should.be.fulfilled;
		});

		it('entity "test" should only have "create"/"list" queries', () => {
			const testEntity = app.entities.get('test');
			return testEntity.getQueries().map(query => query.id)
				.should.deep.equal(['list', 'create']);
		});

		it('should run default "create" query with value', () => {
			const testEntity = app.entities.get('test');
			return testEntity.getQuery('create').run({'test': 'Hello world !'}, {raw: true})
			.should.become({
				test: 'Hello world !'
			});
		});

		it('should run default "create" query without value', () => {
			const testEntity = app.entities.get('test');
			return testEntity.getQuery('create').run(null, {raw: true})
			.should.become({});
		});

		it('should run default "list" query', () => {
			const testEntity = app.entities.get('test');
			return testEntity.getQuery('list').run(null, {raw: true})
				.should.become({
				count: 2,
				data: [{test: 'Hello world !'}, {test: null}]
			})
		});
	});
});