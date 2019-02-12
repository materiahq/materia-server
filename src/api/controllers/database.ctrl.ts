import * as path from 'path';
import * as fs from 'fs';
import { IEntity } from '@materia/interfaces';

import { WebsocketInstance } from '../../lib/websocket';
import { App, Entity, MateriaError, DatabaseLib } from '../../lib';

export class DatabaseController {
	constructor(private app: App, websocket: WebsocketInstance) {}

	tryAuth(req, res) {
		const conf = req.body;
		this.app.database.tryDatabase(conf)
			.then((data) => {
				res.status(200).json(data);
			}).catch(e => {
				res.status(500).json(e);
			});
	}

	getEntities(req, res) {
		return res.status(200).send({entities: DatabaseLib.loadEntitiesJson(this.app)});
	}

	getRelations(req, res) {
		return res.status(200).send({relations: this.app.entities.findAllRelations({ implicit: true })});
	}

	createEntity(req, res) {
		const entity: IEntity = req.body;
		let p: Promise<Entity>;
		this.app.watcher.disable();
		if (entity.virtual) {
			p = this.app.entities
			.addVirtual(
				{
					name: entity.name,
					fields: entity.fields
				},
				{
					apply: true,
					save: true,
					history: true
				}
			);
		} else {
			p = this.app.entities
			.add(
				{
					name: entity.name,
					fields: entity.fields
				},
				{
					apply: true,
					save: true,
					history: true
				}
			);
		}
		return p.then((ent: Entity) => {
				this.app.watcher.enable();
				res.status(201).json(ent.toJson());
			}).catch(err => {
				this.app.watcher.enable();
				res.status(500).json(err);
			});
	}

	removeEntity(req, res) {
		const name = req.params.entity;
		this.app.watcher.disable();
		this.app.entities.remove(name, {
			save: true,
			apply: true,
			history: true
		}).then(() => {
			this.app.watcher.enable();
			res.status(200).json({ entities: DatabaseLib.loadEntitiesJson(this.app), endpoints: this.app.api.findAll().map(e => e.toJson()) });
		}).catch(e => {
			this.app.watcher.enable();
			res.status(500).json(e);
		});
	}

	moveEntity(req, res) {
		const {x, y} = req.body;
		const entity = this.app.entities.get(req.params.entity);
		if ( ! entity ) {
			return res.status(400).json(new Error(`Entity ${req.params.entity} does not exist`));
		}
		this.app.watcher.disable();
		entity.move(x, y).then(() => {
			this.app.watcher.enable();
			res.status(200).json(entity.toJson());
		}).catch(err => {
			this.app.watcher.enable();
			res.status(500).send(err);
		});
	}

	renameEntity(req, res) {
		const oldName = req.params.entity;
		const {new_name} = req.body;
		this.app.watcher.disable();
		this.app.entities.rename(oldName, new_name, {
				save: true,
				apply: true,
				history: true
			})
			.then(() => {
				this.app.watcher.enable();
				res.status(200).json(
				Object.assign({}, this.app.entities.get(new_name).toJson(), {
					name: new_name
				}));
			}).catch(e => {
				this.app.watcher.enable();
				res.status(500).json(e);
			});
	}

	saveField(req, res) {
		const field = req.body;
		const entityName = req.params.entity;
		const entity = this.app.entities.get(entityName);

		if ( ! entity) {
			return res.status(400).send(new MateriaError(`Entity ${req.params.entity} does not exists`));
		}

		if (field.primary) {
			field.unique = true;
		}

		if (field.unique) {
			field.required = true;
			if (field.default) {
				delete field.default;
			}
			if (field.autoIncrement) {
				delete field.autoIncrement;
			}
		}

		// TODO: add this when uniqueGroup enabled
		// if (field.hasUniqueGroup && field.uniqueGroup) {
		// 	field.unique = field.uniqueGroup;
		// 	if (field.autoIncrement) {
		// 		delete field.autoIncrement;
		// 	}
		// }

		if (field.required) {
			field.default = false;
			if (field.defaultValue) {
				delete field.defaultValue;
			}
		}

		if (field.type !== 'number' && field.autoIncrement) {
			delete field.autoIncrement;
		}

		this.app.watcher.disable();
		let promise;

		if (entity.getField(field.name)) {
			promise = entity.updateField(field.name, field, {
				save: true,
				apply: true,
				history: true,
				db: true
			});
		} else {
			promise = entity.addField(field, {
				save: true,
				apply: true,
				history: true,
				db: true
			});
		}
		promise.then(() => {
			this.app.watcher.enable();
			return res.status(200).send(DatabaseLib.loadEntitiesJson(this.app));
		}).catch(err => {
			this.app.watcher.enable();
			return res.status(500).send(err);
		});
	}

	loadModel(req, res) {
		const fromAddon: string = req.query.fromAddon;
		const modelName: string = req.params.model;

		const basePath = fromAddon
			? fromAddon
			: path.join(this.app.path, 'server', 'models', 'queries');

		fs.readFile(
			path.join(basePath, modelName + '.js'),
			'utf-8',
			(err, data) => {
				if (err) {
					return res.status(500).json(err);
				}
				if (data) {
					const code = data.toString();
					return res.status(200).send(code);
				} else {
					return res.status(200).send();
				}
			}
		);
	}

	removeField(req, res) {
		const { entityName, field } = req.params;
		const entity = this.app.entities.get(entityName);
		if ( ! entity) {
			return res.status(400).send(new MateriaError(`Entity ${entityName} does not exists`));
		}
		this.app.watcher.disable();
		entity.removeField(field, {
			save: true,
			apply: true,
			history: true
		})
		.then(() => {
			this.app.watcher.enable();
			res.status(200).json(DatabaseLib.loadEntitiesJson(this.app));
		})
		.catch(e => {
			this.app.watcher.enable();
			res.status(500).json(e);
		});
	}

	createQuery(req, res) {
		const entity = this.app.entities.get(req.params.entity);
		const query = req.body;
		if ( ! entity) {
			return res.status(400).send(new MateriaError(`Entity ${req.params.entity} does not exists`));
		}
		this.app.watcher.disable();
		let p = Promise.resolve();
		if (query.type == 'sql') {
			query.opts.query = query.code;
		}
		if (query.type == 'custom') {
			const basePath = entity.fromAddon
				? entity.fromAddon.path
				: this.app.path;
			p = p.then(() => this.app.saveFile(
				path.join(
					basePath,
					'server',
					'models',
					'queries',
					query.opts.model + '.js'
				),
				query.code,
				{ mkdir: true }
			));
		}
		p.then(() => entity.addQuery(query)).then(() => {
			this.app.watcher.enable();
			res.status(200).send(DatabaseLib.loadEntitiesJson(this.app));
		}).catch(err => {
			this.app.watcher.enable();
			res.status(500).send(err);
		});
	}

	removeQuery(req, res) {
		const entity = this.app.entities.get(req.params.entity);
		if ( ! entity) {
			return res.status(400).send(new MateriaError(`Entity ${req.params.entity} does not exists`));
		}
		this.app.watcher.disable();
		entity.removeQuery(req.params.queryId).then(() => {
			this.app.watcher.enable();
			res.status(200).json(DatabaseLib.loadEntitiesJson(this.app));
		}).catch(err => {
			this.app.watcher.enable();
			res.status(500).send(err);
		});
	}

	runQuery(req, res) {
		const {entityName, queryId} = req.params;

		const entity = this.app.entities.get(entityName);
		if ( ! entity ) {
			return res.status(400).json(new Error(`Entity ${entityName} does not exists`));
		}
		const query: any = entity.getQuery(queryId);

		if ( ! query ) {
			return res.status(400).json(new Error(`Query ${queryId} does not exists (${entityName})`));
		}
		query.run(req.body, { raw: true })
			.then((response: any) => {
				if (Array.isArray(response)) {
					const result = { data: response, count: response.length };
					return result;
				} else if (typeof response === 'string' || typeof response === 'number') {
					return { data: [{ response: response }], count: 1 };
				} else if (typeof response === 'object') {
					const keys = Object.keys(response);
					if (response && keys.indexOf('count') != -1 && keys.indexOf('data') != -1) {
						return response;
					} else {
						return { data: [response], count: 1 };
					}
				}
			}).then(data => {
				res.status(200).json(data);
			}).catch(error => {
				res.status(400).send(error.message);
			});
	}

	listActions(req, res) {
		res.status(200).json(this.app.actions.findAll());
	}

	addAction(req, res) {
		DatabaseLib.generateActionId().then(id => {
			const action = Object.assign({}, req.body, {
				id
			});
			this.app.watcher.disable();
			try {
				this.app.actions.register(action, {
					save: true
				});
				this.app.watcher.enable();
				res.status(200).json(
					DatabaseLib.loadEntitiesJson(this.app)
				);
			} catch (e) {
				this.app.watcher.enable();
				res.status(400).json({
					error: e.message
				});
			}
		}).catch(err => {
			res.status(500).send(err);
		});
	}

	updateAction(req, res) {
		const action = req.body;
		this.app.watcher.disable();
		try {
			action.id = req.params.id;
			if (req.params[0]) {
				action.id += req.params[0];
			}
			this.app.actions.register(action, {
				save: true
			});
			this.app.watcher.enable();
			res.status(200).json(
				DatabaseLib.loadEntitiesJson(this.app)
			);
		} catch (e) {
			this.app.watcher.enable();
			res.status(400).json({
				error: e.message
			});
		}
	}

	removeAction(req, res) {
		let id = req.params.id;
		if (req.params[0]) {
			id += req.params[0];
		}
		this.app.watcher.disable();
		if (this.app.actions.remove(id, { save: true })) {
			this.app.watcher.enable();
			res.status(200).json(
				DatabaseLib.loadEntitiesJson(this.app)
			);
		} else {
			this.app.watcher.enable();
			res.status(400).json({ error: `Action id '${req.params.id}' not found.`});
		}
	}

	createRelation(req, res) {
		const payload = req.body;
		this.app.watcher.disable();
		this.app.entities
			.get(payload.rel2.reference.entity)
			.addRelation(payload.rel1, {
				save: true,
				apply: true,
				history: true,
				db: true
			}).then(() => {
				return this.app.entities
					.get(payload.rel1.reference.entity)
					.addRelation(payload.rel2, {
						save: true,
						apply: true,
						history: true,
						db: true
					});
			}).then(() => {
				this.app.watcher.enable();
				return res.status(201).json({
					entities: DatabaseLib.loadEntitiesJson(this.app),
					relations: this.app.entities.findAllRelations({
						implicit: true
					})
				});
			}).catch(err => {
				this.app.watcher.enable();
				res.status(500).send(err.message);
			});
	}

	removeRelation(req, res) {
		let relation = null;
		const type = req.params.type;
		let entity = this.app.entities.get(req.params.entity);
		if (type === 'belongsToMany') {
			const entityRelation = req.params.relationFieldOrEntity;
			relation = entity.getBelongsToManyRelation(entityRelation);
		} else {
			const field = req.params.relationFieldOrEntity;
			relation = entity.getRelationByField(field);
		}
		if (! relation) {
			return res.status(400).send('Relation not found');
		}
		if (relation.type === 'hasMany' || relation.type === 'hasOne') {
			entity = this.app.entities.get(relation.reference.entity);
			relation = entity.getRelationByField(relation.reference.field);
		}
		if ( ! entity) {
			return res.status(400).send(new MateriaError(`Entity ${req.params.entity} does not exists`));
		}
		this.app.watcher.disable();
		entity.removeRelation(relation, {
			save: true,
			apply: true,
			history: true,
			db: true
		})
		.then(() => {
			this.app.watcher.enable();
			return res.status(200).json({
				entities: DatabaseLib.loadEntitiesJson(this.app),
				relations: this.app.entities.findAllRelations({
					implicit: true
				})
			});
		}).catch(err => {
			this.app.watcher.enable();
			res.status(500).send(err.message);
		});
	}

	runSql(req, res) {
		this.app.database.sequelize
			.query(req.body.opts.query, {
				type: 'sql'
			})
			.then(data => {
				res.status(200).json({
					data: data,
					count: data.length,
					from: 'playground'
				});
			})
			.catch(err => res.status(500).send(err.message));
	}

	getDiffs(req, res) {
		return this.app.synchronizer.diff().then((diffs) => {
			res.status(200).send(diffs);
		}).catch(err => {
			res.status(500).send(err.message);
		});

	}

	sync(req, res) {
		const diffs = req.body.diffs;
		const type = req.body.type;

		if (type === 'entitiesToDatabase') {
			this.app.watcher.disable();
			this.app.synchronizer.entitiesToDatabase(diffs, {save: true})
				.then((result) => {
					this.app.watcher.enable();
					res.status(200).send(result);
				}).catch(err => {
					this.app.watcher.enable();
					res.status(500).send(err);
				});

		} else if (type === 'databaseToEntities') {
			this.app.watcher.disable();
			this.app.synchronizer.databaseToEntities(diffs, {save: true})
				.then((result) => {
					this.app.watcher.enable();
					res.status(200).send(result);
				}).catch(err => {
					this.app.watcher.enable();
					res.status(500).send(err.message);
				});
		} else {
			return res.status(500).send(new Error(`Sync type '${type}' not found`));
		}
	}
}