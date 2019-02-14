import * as fse from 'fs-extra';
import chalk from 'chalk';
import * as Sequelize from 'sequelize';
import { join } from 'path';
import { IEndpoint, IApplyOptions, IField } from '@materia/interfaces';

import { App } from './app';
import { MateriaError } from './error';

import { Addon } from './addons/addon';

import { MigrationType } from './history';

import { CustomQuery } from './entities/queries/custom';

import { DBEntity } from './entities/db-entity';
import { Entity } from './entities/entity';
import { ConfigType } from './config';
import { VirtualEntity } from './entities/virtual-entity';

/**
 * @class Entities
 * @classdesc
 * Entity manager. This class is relative to all the entities of an app.
 */
export class Entities {
	entities: {[name: string]: Entity};
	entitiesJson: {[path: string]: Array<any>};

	constructor(public app: App) {
		this.entities = {};
		this.entitiesJson = {};

		this.app.history.register(MigrationType.CREATE_ENTITY, (data, opts) => {
			return this.add(data.value, opts);
		});

		this.app.history.register(MigrationType.RENAME_ENTITY, (data, opts): any => {
			return this.rename(data.table, data.value, opts);
		});

		this.app.history.register(MigrationType.DELETE_ENTITY, (data, opts) => {
			return this.remove(data.table, opts);
		});

		this.app.history.register(MigrationType.ADD_FIELD, (data, opts) => {
			return this.get(data.table).addFieldAt(data.value as IField, data.position, opts);
		});

		this.app.history.register(MigrationType.CHANGE_FIELD, (data, opts) => {
			return this.get(data.table).updateField(data.name, data.value, opts);
		});

		this.app.history.register(MigrationType.DELETE_FIELD, (data, opts) => {
			return this.get(data.table).removeField(data.value, opts);
		});


		this.app.history.register(MigrationType.ADD_RELATION, (data, opts) => {
			return this.get(data.table).addRelation(data.value, opts);
		});

		this.app.history.register(MigrationType.DELETE_RELATION, (data, opts) => {
			return this.get(data.table).removeRelation(data.value, opts);
		});


		this.app.history.register(MigrationType.ADD_QUERY, (data, opts) => {
			const query = Object.assign({}, data.values);
			query.id = data.id;
			this.get(data.table).addQuery(query, opts);
			return Promise.resolve();
		});

		this.app.history.register(MigrationType.DELETE_QUERY, (data, opts) => {
			this.get(data.table).removeQuery(data.id, opts);
			return Promise.resolve();
		});
	}

	clear(): void {
		this.entities = {};
		this.entitiesJson = {};
	}

	cleanFiles(): void {
		delete this.entitiesJson;
		this.entitiesJson = {};
	}

	loadFiles(addon?: Addon): Promise<any> {
		const basePath = addon ? addon.path : this.app.path;

		this.entitiesJson[basePath] = [];

		let files;
		let p = Promise.resolve();
		try {
			files = fse.readdirSync(join(basePath, 'server', 'models'));
			p = p.then(() => Promise.resolve());
		} catch (e) {
			files = [];
			fse.mkdirsSync(join(basePath, 'server', 'models'));
			return Promise.resolve(false);
		}
		const entitiesPositions = this.app.config.get<{[name: string]: {x: number, y: number}}>(null, ConfigType.ENTITIES_POSITION) || {};
		for (const file of files) {
			try {
				if (file.substr(file.length - 5, 5) == '.json') {
					const content = fse.readFileSync(join(basePath, 'server', 'models', file));
					const entity = JSON.parse(content.toString());
					entity.name = file.substr(0, file.length - 5);
					if (entitiesPositions[entity.name]) {
						entity.x = entitiesPositions[entity.name].x;
						entity.y = entitiesPositions[entity.name].y;
					}
					this.entitiesJson[basePath].push(entity);
					p = p.then(() => Promise.resolve());
				}
			} catch (e) {
				e += ' in ' + file;
				this.app.logger.error(new Error(e));
				p = p.then(() => Promise.resolve());
			}
		}

		return p;
	}

	loadEntities(addon?: Addon): Promise<Entity[]> {
		const basePath = addon ? addon.path : this.app.path;
		const promises: Promise<Entity>[] = [];
		const opts: IApplyOptions = {
			history: false,
			db: false,
			save: false,
			wait_relations: true
		};
		if (addon) {
			opts.fromAddon = addon;
			if (this.entitiesJson[basePath].length > 0) {
				this.app.logger.log(` │ └─┬ ${addon.package}`);
			}
		} else if (this.entitiesJson[basePath].length > 0) {
			this.app.logger.log(` │ └─┬ Application`);
		}


		for (const file of this.entitiesJson[basePath]) {
			this.app.logger.log(` │ │ └── ${chalk.bold(file.name)}`);
			if (file.virtual) {
				promises.push(this.addVirtual(file, opts));
			} else {
				if ( ! this.app.database.disabled ) {
					promises.push(this.add(file, opts));
				}
			}
		}

		return Promise.all(promises);
	}

	loadQueries(addon?: Addon): Promise<void> {
		const basePath = addon ? addon.path : this.app.path;


		if (this.entitiesJson[basePath].length > 0) {
			if (addon) {
				this.app.logger.log(` │ └─┬ ${addon.package}`);
			} else {
				this.app.logger.log(` │ └─┬ Application`);
			}
		}

		try {
			for (const entityJson of this.entitiesJson[basePath]) {
				const entity = this.get(entityJson.name);
				if (entity) {
					entity.loadQueries(entityJson.queries);
				}
			}
		} catch (e) {
			return Promise.reject(e);
		}
		return Promise.resolve();
	}

	loadRelations(): Promise<any> {
		if ( this.app.database.disabled ) {
			return Promise.resolve();
		}

		const promises = [];
		for (const name in this.entities) {
			if (this.entities[name]) {
				const entity = this.entities[name];
				promises.push(entity.applyRelations());
			}
		}

		return Promise.all(promises);
	}

	start(): Promise<any> {
		if ( this.app.database.disabled ) {
			return Promise.resolve();
		}

		// detect rename then sync database
		// return this.detect_rename().then(() => {
			// return this._save_id_map()
		return Promise.resolve()
		.then(() => {
			// Convert orphan n-n through tables
			const promises = [];
			for (const name in this.entities) {
				if (this.entities[name]) {
					promises.push(this.entities[name].fixIsRelation({save: false, db: false, history: false}));
				}
			}
			return Promise.all(promises);
		}).then(() => {
			return this.sync();
		}).then(() => {
			return this.detect_rename();
		}).then(() => {
			return this.app.database.sequelize.sync();
		});
	}

	/**
	Add a new virtual entity
	@param {object} - Entity description
	@param {object} - Action's options
	@returns {Promise<Entity>}
	*/
	addVirtual(entityobj, options?) {
		options = options || {};

		let entity: VirtualEntity | Entity, createPromise: Promise<any>;
		if (entityobj instanceof Entity) {
			entity = entityobj;
			createPromise = Promise.resolve();
		} else {
			if (! entityobj.name) {
				return Promise.reject(new MateriaError('missing entity name'));
			}
			entity = new VirtualEntity(this.app);

			if (entityobj.overwritable && this.entities[entity.name] && options.apply) {
				return Promise.resolve(entity);
			}
			createPromise = entity.create(entityobj, {wait_relations: options.wait_relations, fromAddon: options.fromAddon});
		}

		return createPromise.then(() => {
			if (options.apply != false) {
				this.entities[entity.name] = entity;
				this.app.emit('entity:added', entity);
			}

			if (options.save != false) {
				return entity.save().then(() => this._save_id_map(options));
			}
		}).then(() => {
			if (options.overwritable) {
				return entity;
			}

			if (options.history != false) {
				this.app.history.push({
					type: MigrationType.CREATE_ENTITY,
					table: entity.name,
					value: entity.toJson()
				}, {
					type: MigrationType.DELETE_ENTITY,
					table: entity.name
				});
			}

			let p;
			if (options.apply != false) {
				entity.generateDefaultQueries();
				p = this.sync().then(() => {
					entity.refreshQueries();
				});
			} else {
				p = entity.loadModel();
			}

			return p.then(() => {
				return entity;
			});
		});
	}

	/**
	Add a new entity
	@param {object} - Entity description
	@param {object} - Action's options
	@returns {Promise<Entity>}
	*/
	add(entityobj, options?): Promise<Entity> {
		if (this.app.database.disabled) {
			return Promise.reject({error: true, message: 'The database is disabled'});
		}
		options = options || {};

		let entity: Entity, createPromise;
		if (entityobj instanceof Entity) {
			entity = entityobj;
			createPromise = Promise.resolve();
		} else {
			if (! entityobj.name) {
				return Promise.reject(new MateriaError('missing entity name'));
			}
			entity = new DBEntity(this.app);
			if ( ! entityobj.isRelation && (! entityobj.fields || ! entityobj.fields.length)) {
				entityobj.fields = [
					{
						'name': 'id_' + entityobj.name,
						'type': 'number',
						'required': true,
						'primary': true,
						'unique': true,
						'default': false,
						'autoIncrement': true,
						'read': true,
						'write': false
					}
				];
			}

			if (entityobj.overwritable && this.entities[entity.name] && options.apply) {
				return Promise.resolve(entity);
			}
			if (entityobj.isRelation && entityobj.relations) {
				delete entityobj.relations; // NEED TO CHECK THIS / NOT SURE ITS GOOD AS A RELATION TABLE CAN ALSO HAVE RELATIONS
			}
			createPromise = entity.create(entityobj, {wait_relations: options.wait_relations, fromAddon: options.fromAddon});
		}

		return createPromise.then(() => {
			if (options.apply != false) {
				this.entities[entity.name] = entity;
				this.app.emit('entity:added', entity);
			}

			if (options.save != false) {
				return entity.save().then(() => this._save_id_map(options));
			} else {
				return Promise.resolve();
			}
		}).then(() => {
			if (options.overwritable) {
				return entity;
			}

			if (options.history != false) {
				this.app.history.push({
					type: MigrationType.CREATE_ENTITY,
					table: entity.name,
					value: entity.toJson()
				}, {
					type: MigrationType.DELETE_ENTITY,
					table: entity.name
				});
			}

			if (options.db == false) {
				return entity;
			}

			let p = Promise.resolve();
			if (options.apply != false) {
				entity.generateDefaultQueries();
				p = this.sync().then(() => {
					return entity.refreshQueries();
				});
			} else {
				p = entity.loadModel();
			}

			return p.then(() => {
				return entity.model.sync();
			}).then(() => {
				return entity;
			});
		});
	}

	detect_rename(): Promise<any> {
		let name_map;
		try {
			const content = fse.readFileSync(join(this.app.path, '.materia', 'ids.json')).toString();
			name_map = JSON.parse(content);
		} catch (e) {
			if (e.code == 'ENOENT') {
				return Promise.resolve();
			}
			console.error(e);
			return Promise.reject(e);
		}

		const diffs = [];
		for (const entity_name in this.entities) {
			if (this.entities[entity_name]) {
				const entity = this.entities[entity_name];
				if (name_map[entity.id] && name_map[entity.id] != entity_name) {
					diffs.push({
						redo: {
							type: MigrationType.RENAME_ENTITY,
							table: name_map[entity.id],
							value: entity_name
						},
						undo: {
							type: MigrationType.RENAME_ENTITY,
							table: entity_name,
							value: name_map[entity.id]
						}
					});
				}
			}
		}

		if (diffs.length == 0) {
			return Promise.resolve();
		}

		for (const diff of diffs) {
			this.app.logger.log(chalk.bold(`Detected entity rename: ${chalk.yellow(diff.redo.table)} -> ${chalk.yellow(diff.redo.value)}`));
		}

		return this.app.history.apply(diffs, {
			full_rename: false
		});
	}

	/**
	Delete an entity.
	@param {string} - Entity's name
	@param {object} - Action's options
	@returns {Promise}
	*/
	remove(name: string, options?: IApplyOptions): Promise<any> {
		options = options || {};

		if ( ! name) {
			return Promise.reject(new MateriaError('You must specify a entity name'));
		}

		const endpoints: IEndpoint[] = this.app.api.findAll().map(e => e.toJson());
		const relatedEndpoints: IEndpoint[] = endpoints.filter((e: IEndpoint) => e.query && e.query.entity === name);
		for (const endpoint of relatedEndpoints) {
			this.app.api.remove(endpoint.method, endpoint.url);
		}

		let p = Promise.resolve();
		for (const entity_name in this.entities) {
			if (this.entities[entity_name]) {
				for (const relation of this.entities[entity_name].relations) {
					if (relation.reference.entity == name) {
						p = p.then(() => {
							return this.entities[entity_name].removeRelation(relation, options);
						});
					}
				}
			}
		}

		return p.then(() => {
			const entity = this.entities[name];

			if (options.history != false) {
				this.app.history.push({
					type: MigrationType.DELETE_ENTITY,
					table: name
				}, {
					type: MigrationType.CREATE_ENTITY,
					table: name,
					value: entity.toJson()
				});
			}

			if (options.apply != false) {
				delete this.entities[name];
			}

			const relativePath = join('server', 'models', name + '.json');
			if (options.save != false && entity && fse.existsSync(join(this.app.path, relativePath))) {

				// TODO: this.app.path replaced by basepath computed with fromAddon
				fse.unlinkSync(join(this.app.path, relativePath));
			}

			if (options.db == false) {
				return Promise.reject(new MateriaError('Cannot delete entity (database is disabled)'));
			}

			// TODO: remove constraint to avoid force:true ? more tests needed
			return this.app.database.sequelize.getQueryInterface().dropTable(name, {force: true} as Sequelize.QueryOptions);
		});
	}

	/**
	Rename an entity
	@param {string} - Entity's name (old name)
	@param {string} - Entity's new name
	@param {object} - Action's options
	@returns {Promise}
	*/
	rename(name: string, new_name: string, options?): Promise<any> {
		options = options || {};
		const entity = this.get(name);

		if ( ! entity && options.full_rename != false) {
			return Promise.reject(new MateriaError('Entity ' + name + ' does not exist.'));
		}

		if ( entity && this.get(new_name)) {
			return Promise.reject(new MateriaError('Entity ' + new_name + ' already exists.'));
		}

		let p = Promise.resolve();

		if (options.history != false) {
			this.app.history.push({
				type: MigrationType.RENAME_ENTITY,
				table: name,
				value: new_name
			}, {
				type: MigrationType.RENAME_ENTITY,
				table: new_name,
				value: name
			});
		}

		const entitiesChanged = entity ? [entity] : [];
		if (options.apply != false) {
			for (const entity_name in this.entities) {
				if (this.entities[entity_name]) {
					const ent = this.entities[entity_name];
					let need_save = false;
					for (const relation of ent.relations) {
						if (relation.reference && relation.reference.entity == name) {
							need_save = true;
							relation.reference.entity = new_name;
						}
						if (relation.through == name) {
							need_save = true;
							relation.through = new_name;
						}
					}
					if (need_save && options.save != false) {
						entitiesChanged.push(entity);
						p = p.then(() => entity.save());
					}
				}
			}

			/*if (entity.fields[0].name == 'id_' + name) {
				entity.fields[0].name = 'id_' + new_name
				// TODO: rename field (with options db:options.db save:false history:false)
			}*/

			if (entity) {
				entity.name = new_name;
				this.entities[new_name] = entity;
				delete this.entities[name];
			}
		}

		if (options.save != false) {
			const relativePath = join('server', 'models', name + '.json');
			if (fse.existsSync(join(this.app.path, relativePath))) {
				fse.unlinkSync(join(this.app.path, relativePath));
				p = p.then(() => this._save_id_map(options));
			}
			p = p.then(() => this.save());
		}


		if (options.db == false) {
			return Promise.resolve();
		}

		return p.then(() =>
				this.app.database.sequelize.getQueryInterface().renameTable(name, new_name)
			).then(() => {
				let promise = Promise.resolve();
				for (const ent of entitiesChanged) {
					promise = promise.then(() => {
						return ent.loadModel().then(() => {
							ent.loadRelationsInModel();
						});
					});
				}
				return promise;
		});
	}

	/**
	Returns a list of the entities
	@returns {Array<Entity>}
	*/
	findAll() {
		const entities = [];
		for (const entity in this.entities) {
			if (this.entities[entity]) {
				entities.push(this.entities[entity]);
			}
		}
		return entities;
	}

	/**
	Returns an entity be specifying its name
	@param {string} - Entity's name
	@returns {Entity}
	*/
	get(name): Entity { return this.entities[name]; }

	/**
	Returns an entity be specifying its name, or create it with its description
	@param {string} - Entity's name
	@param {string} - Entity's description
	@param {string} - Action's options
	@returns {Entity}
	*/
	getOrAdd(name, entityobj, options) {
		if (this.entities[name]) {
			return Promise.resolve(this.entities[name]);
		}
		entityobj.name = name;
		return this.add(entityobj, options);
	}

	save(): Promise<void> {
		let p = Promise.resolve();
		for (const entity in this.entities) {
			if (this.entities[entity]) {
				p = p .then(() => this.entities[entity].save());
			}
		}
		return p;
	}

	sync() {
		const promises = [];
		for (const ent in this.entities) {
			if (this.entities[ent]) {
				promises.push(this.entities[ent].loadModel().catch((err) => {
					err.message = 'Could not load entity ' + ent + ': ' + err.message;
					throw err;
				}));
			}
		}

		return Promise.all(promises).then(() => {
			// Need a second loop to executes relations when all models are created
			for (const ent in this.entities) {
				if (this.entities[ent]) {
					this.entities[ent].loadRelationsInModel();
				}
			}
		});
	}

	findAllRelations(opts) {
		opts = opts || {};
		const res = [];
		for (const ent in this.entities) {
			if (this.entities[ent]) {
				const entity = this.entities[ent];
				for (const r of entity.relations) {
					if ( ! r.implicit || opts.implicit) {
						r.entity = ent;
						res.push(r);
					}
				}
				if (entity.isRelation && opts.implicit) {
					for (const f of entity.getFields()) {
						const r = f.isRelation;
						if (r) {
							r.entity = ent;
							r.implicit = true;
							r.field = f.name;
							res.push(r);
						}
					}
				}
			}
		}
		return res;
	}

	getModels(addon?: Addon) {
		return Object.keys(CustomQuery.models).filter((value) => {
			return (addon && value.substr(0, addon.name.length + 1) == addon.name + '/')
				|| ( ! addon && value.indexOf('/') == -1);
		});
	}

	resetModels(): void {
		if ( ! this.app.database.disabled ) {
			CustomQuery.resetModels();
		}
	}

	private _save_id_map(opts?): Promise<any> {
		opts = opts || {};

		const name_map = {};
		for (const entity_name in this.entities) {
			if (this.entities[entity_name]) {
				const entity = this.entities[entity_name];
				name_map[entity.id] = entity_name;
			}
		}

		const actions = Object.assign({}, opts);
		actions.mkdir = true;
		return this.app.saveFile(join(this.app.path, '.materia', 'ids.json'), JSON.stringify(name_map, null, '\t'), actions);
	}
}