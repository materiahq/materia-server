import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fse from 'fs-extra';
import * as path from 'path';

import { App } from '../../lib/app';
import { TemplateApp } from '../mock/template-app';

chai.config.truncateThreshold = 500;
chai.use(chaiAsPromised);
chai.should();

describe('[Database synchronizer: from database to entities]', () => {
	let app: App;
	const tmpl = new TemplateApp('empty-app');
	const entity1 = {
		name: 'test1',
		id: 'fake-id',
		fields: [
			{
				name: 'id_test1',
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
	};
	const entity2 = {
		name: 'test2',
		id: 'fake-id2',
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
			}
		]
	};
	const entity3 = {
		name: 'test3',
		id: 'fake-id3',
		fields: [
			{
				name: 'id_test3',
				type: 'number',
				read: true,
				write: false,
				primary: true,
				unique: true,
				required: true,
				autoIncrement: true,
				component: 'input'
			}, {
				name: 'test1',
				type: 'text',
				read: true,
				write: true
			}
		]
	};

	before(() => {
		tmpl.beforeCreate(new_app => {
			new_app.server.disabled = true;
		});
		return tmpl.runApp().then(_app => (app = _app));
	});

	it('should prepare entities', () => {
		return app.entities.add(entity1, { apply: true, db: true }).then(() =>
			app.entities.add(entity2, { apply: true, db: true })
		).then(() =>
			app.entities.add(entity3, { apply: true, db: true })
		).then(() =>
			app.entities.get('test1').addRelation({
				type: 'belongsTo',
				field: 'id_test2',
				reference: {
					entity: 'test2',
					field: 'id_test2'
				}
			})
		).then(() =>
			app.entities.get('test2').addRelation({
				type: 'belongsTo',
				field: 'id_test3',
				reference: {
					entity: 'test3',
					field: 'id_test3'
				}
			})
		).then(() =>
			app.entities.get('test3').addRelation({
				type: 'belongsTo',
				field: 'id_test1',
				reference: {
					entity: 'test1',
					field: 'id_test1',
				}
			})
		).then(() => app.entities.findAll().map(({ name }) => name)
		).should.be.fulfilled.and.eventually.have.members(['test1', 'test2', 'test3']);
	});

	it('should have empty diffs', () => {
		return app.synchronizer
			.diff()
			.should.become({
				entities: [],
				fields: [],
				relations: [],
				length: 0
			});
	});

	it('should have diffs after deleting "test.json" model file', () => {
		return Promise.all([
			fse.remove(path.join(app.path, 'server', 'models', 'test1.json')),
			fse.remove(path.join(app.path, 'server', 'models', 'test2.json')),
			fse.remove(path.join(app.path, 'server', 'models', 'test3.json'))
		]).then(() => {
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
		.should.be.fulfilled
		.and.eventually.have.property('entities');
	});

	it('should syncrhonize and re-add test model file with same intial property', () => {
		return app.synchronizer.diff()
		.then((diffs) => {
			return app.synchronizer.databaseToEntities(diffs, null);
		}).then(() => {
			return app.entities.findAll().map(({ name }) => name);
		}).should.be.fulfilled.and.eventually.have.members(['test1', 'test2', 'test3']);
	});
});
