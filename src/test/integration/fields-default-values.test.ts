import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { App } from '../../lib/app';
import { TemplateApp } from '../mock/template-app';

chai.config.truncateThreshold = 500;
chai.use(chaiAsPromised);
const should = chai.should();

describe('[Fields with default value]', () => {
	let app: App;
	const tmpl = new TemplateApp('empty-app');

	before(() => {
		tmpl.beforeCreate(new_app => {
			new_app.server.disabled = true;
		});
		return tmpl.runApp().then(_app => (app = _app));
	});

	describe('App', () => {
		it('should create a simple entity "test"', () => {
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
						},
						{
							name: 'last_update',
							type: 'date',
							read: true,
							required: true,
							write: true,
							default: true,
							defaultValue: 'now()',
							component: 'datePicker'
						}
					]
				})
				.then(() => {
					should.exist(app.entities.get('test'));
					return app.entities.get('test').toJson();
				})
				.should.become({
					id: 'fake-id',
					x: undefined,
					y: undefined,
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
						},
						{
							name: 'last_update',
							type: 'date',
							read: true,
							required: true,
							write: true,
							default: true,
							defaultValue: 'now()',
							component: 'datePicker'
						}
					],
					relations: [],
					queries: []
				});
		});

		it('should run default "create" query', () => {
			const testEntity = app.entities.get('test');
			return testEntity
				.getQuery('create')
				.run(null, { raw: true })
				.then(result => {
					return result.id_test;
				})
				.should.become(1);
		});

		it('should add field with date type and "defaultValue = now()"', () => {
			const testEntity = app.entities.get('test');
			return testEntity.addField({
				name: 'last_update_2',
				type: 'date',
				read: true,
				required: true,
				write: true,
				default: true,
				defaultValue: 'now()',
				component: 'datePicker'
			}).should.fulfilled;
		});

		it('should run default "create" query', () => {
			const testEntity = app.entities.get('test');
			return testEntity
				.getQuery('create')
				.run(null, { raw: true })
				.then(result => {
					return result.id_test;
				})
				.should.become(2);
		});

		it('should run default "List" query', () => {
			const testEntity = app.entities.get('test');
			return testEntity
				.getQuery('list')
				.run(null, { raw: true })
				.then(result => {
					return result.count;
				})
				.should.become(2);
		});
	});
});
