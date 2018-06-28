import { App, DBEntity } from '../../lib';
import { IEntity } from '@materia/interfaces';

import * as path from 'path';
import * as fs from 'fs';
import { WebsocketInstance } from '../../lib/websocket';

export class DatabaseController {
	constructor(private app: App, websocket: WebsocketInstance) {}

	tryAuth(req, res) {
		const conf = req.body;
		this.app.database.tryDatabase(conf)
			.then((data) => {
				res.status(200).json(data);
			}).catch(e => {
				res.status(500).json(e);
			})
	}

	createEntity(req, res) {
		const entity = req.body;
		this.app.entities
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
			).then(e => {
				res.status(201).json(e.toJson());
			}).catch(e => res.status(500).json(e));
	}

	removeEntity(req, res) {
		const name = req.params.entity;
		this.app.entities.remove(name, {
			save: true,
			apply: true,
			history: true
		}).then(() => res.status(200).json({ removed: true }))
		.catch(e => res.status(500).json(e));
	}

	moveEntity(req, res) {
		const {x, y} = req.body;
		this.app.watcher.disable();
		const entity = this.app.entities.get(req.params.entity);
		if ( ! entity ) {
			return res.status(500).json(new Error(`Entity ${req.params.entity} does not exist`));
		}
		entity.move(x, y).then(() => {
			// Hack: I don't know why we need this timeout, move(x, y) should be resolved when the file is written
			// Need more investigation.
			this.app.watcher.enable();
			res.status(200).json(entity.toJson());
		});
	}

	renameEntity(req, res) {
		const oldName = req.params.entity;
		const {new_name} = req.body;

		this.app.entities
			.rename(oldName, new_name, {
				save: true,
				apply: true,
				history: true
			})
			.then(() => res.status(200).json(
				Object.assign({}, this.app.entities.get(new_name).toJson(), {
					name: new_name
				}))
			).catch(e => res.status(500).json(e));
	}

	saveField(req, res) {
		const field = req.body;
		const entityName = req.params.entity;

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

		if (field.type != 'number' && field.autoIncrement) {
			delete field.autoIncrement;
		}

		const en = this.app.entities.get(entityName);
		let promiseResponse;
		if (en.getField(field.name)) {
			promiseResponse = en.updateField(field.name, field, {
				save: true,
				apply: true,
				history: true
			});
		} else {
			promiseResponse = en.addField(field, {
				save: true,
				apply: true,
				history: true
			});
		}
		promiseResponse.then(() => {
			return res.status(200).json(DatabaseLib.loadEntitiesJson(this.app));
		}).catch(e => res.status(500).json(e));
	}

	updateField(req, res) {

	}


	loadModel(req, res) {
		const fromAddon: string = req.query.fromAddon
		const modelName: string = req.params.model

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
					res.send(code);
				} else {
					res.send();
				}
			}
		);
	}

	removeField(req, res) {
		const { entity, field } = req.params;

		this.app.entities
			.get(entity)
			.removeField(field, {
				save: true,
				apply: true,
				history: true
			})
			.then(() => res.status(200).json(DatabaseLib.loadEntitiesJson(this.app)))
			.catch(e => res.status(500).json(e));
	}

	createQuery(req, res) {
		// const entities = Object.assign({}, this.app.entities.entities);
		/*let entity;
		let p;
		for (const en in entities) {
			if (entities[en]) {
				const e = entities[en];
				if (e.name == selected) {
					entity = e;
				}
			}
		}*/
		const entity = this.app.entities.get(req.params.entity)
		const query = req.body;
		if (entity) {
			if (query.type == 'sql') {
				query.opts.query = query.code;
			}
			if (query.type == 'custom') {
				const basePath = entity.fromAddon
					? entity.fromAddon.path
					: this.app.path;
				this.app.saveFile(
					path.join(
						basePath,
						'server',
						'models',
						'queries',
						query.opts.model + '.js'
					),
					query.code,
					{ mkdir: true }
				).then(res => {
					entity.addQuery(query);
					res.status(200).json(DatabaseLib.loadEntitiesJson(this.app));
				});
			} else {
				entity.addQuery(query);
				res.status(200).json(DatabaseLib.loadEntitiesJson(this.app));
			}
		}
	}

	removeQuery(req, res) {
		const entity = this.app.entities.get(req.params.entity);
		entity.removeQuery(req.params.queryId);
		res.status(200).json(DatabaseLib.loadEntitiesJson(this.app));
	}

	runQuery(req, res) {
		const {entity, queryId} = req.params;

		const query: any = this.app.entities.get(entity).getQuery(queryId);

		let result;
		if (query.type !== 'custom' && query.type !== 'sql') {
			result = this.app.entities
				.get(entity)
				.getQuery(queryId)
				.run(req.body, { raw: true })
		} else {
			result = this.app.entities
				.get(entity)
				.getQuery(queryId)
				.run(req.body, { raw: true })
				.then((res: any) => {
					if (Array.isArray(res)) {
						const result = { data: res, count: res.length };
						return result;
					} else if (typeof res === 'string' || typeof res === 'number') {
						return { data: [{ response: res }], count: 1 };
					} else if (typeof res === 'object') {
						if (res.count && res.data) {
							return res;
						} else {
							return { data: [res], count: 1 };
						}
					}
				});
		}
		result.then(data => {
			res.status(200).json(data);
		}).catch(e => {
			res.status(500).json(e);
		});
	}

	createRelation(req, res) {
		const payload = req.body;
		this.app.entities
			.get(payload.rel2.reference.entity)
			.addRelation(payload.rel1, {
				save: true,
				apply: false,
				history: true,
				db: true
			})
			.then(() => {
				return this.app.entities
					.get(payload.rel1.reference.entity)
					.addRelation(payload.rel2, {
						save: true,
						apply: false,
						history: true,
						db: true
					});
			})
			.then(() => {
				return res.status(201).json({
					entities: DatabaseLib.loadEntitiesJson(this.app),
					relations: this.app.entities.findAllRelations({
						implicit: true
					})
				});
			}).catch(e => res.status(500).json(e));
	}

	removeRelation(req, res) {
		const field = req.params.relationField;
		const entity = this.app.entities.get(req.params.entity);
		const relation = entity.getRelation(field);
		entity.removeRelation(relation, {
			save: true,
			apply: true,
			history: true,
			db: true
		})
		.then(() => {
			return res.status(200).json({
				entities: DatabaseLib.loadEntitiesJson(this.app),
				relations: this.app.entities.findAllRelations({
					implicit: true
				})
			});
		}).catch(e =>
			res.status(500).json(e)
		);
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
			.catch(err => res.status(500).json(err));
	}

	getDiffs(req, res) {
		return this.app.synchronizer.diff().then((diffs) => {
			console.log('Diffs : ', diffs)
			res.status(200).send(diffs);
		}).catch(err => {
			console.log('SYnc error :', err)
			res.status(500).send(err)
		});

	};

	sync(req, res) {
		const diffs = req.body.diffs;
		const type = req.body.type;

		if (type === 'entitiesToDatabase') {
			return this.app.synchronizer.entitiesToDatabase(diffs, null)
				.then((result) =>
					res.status(200).send(result)
				).catch(err => res.status(500).send(err));

		} else if (type === 'databaseToEntities') {
			return this.app.synchronizer.databaseToEntities(diffs, null)
				.then((result) =>
					res.status(200).send(result)
				).catch(err => res.status(500).send(err));
		} else {
			return res.status(500).send(new Error(`Sync type '${type}' not found`));
		}
	}
}

export class DatabaseLib {
	static entitySpacing = 20;
	static loadEntityJson(entity: DBEntity): IEntity {
		return Object.assign({}, entity.toJson(), {
			name: entity.name,
			x: entity.x,
			y: entity.y,
			fields: entity.fields.map(field => {
				return Object.assign({}, field.toJson(), {
					isRelation: field.isRelation
				});
			}),
			queries: entity.getQueries().map(query => {
				const q = query.toJson();
				q.opts.params = query.params;
				return q;
			}),
			fromAddon: entity.fromAddon ? entity.fromAddon.toJson() : null,
			relatedEntities: entity
				.getRelatedEntities()
				.map((relatedEntity: any) =>
					Object.assign({}, relatedEntity.toJson(), {
						name: relatedEntity.name,
						fields: relatedEntity.fields.map(field =>
							field.toJson()
						),
						queries: relatedEntity.getQueries().map(query => {
							const q = query.toJson();
							q.params = query.params;
							return q;
						})
					})
				)
		});
	}

	static loadEntitiesJson(app: App): IEntity[] {
		const entities = app.entities.findAll();
		return entities.map(entity => {
			const finalEntity = DatabaseLib.loadEntityJson(entity);
			if ( ! finalEntity.x && ! finalEntity.y ) {
				const ui = DatabaseLib.loadUi(app.path, entities, entity.name);
				finalEntity.x = isNaN(ui.x) || ui.x < 0 ? 0 : ui.x;
				finalEntity.y = isNaN(ui.y) || ui.y < 0 ? 0 : ui.y;
			}
			// const ui = this.loadUi(app.path, entities, entity.name);
			return finalEntity;
		});
	}
	private static entityWidth(entity) {
		return 200;
	}

	private static entityHeight(entity) {
		return 40 + 48 * entity.fields.length;
	}

	private static getWorkspaceSize(entities) {
		const workspaceSize = { width: 0, height: 0 };
		for (const i in entities) {
			if (entities[i].x != -1 && entities[i].y != -1) {
				const maxX = entities[i].x + DatabaseLib.entityWidth(entities[i]);
				const maxY = entities[i].y + DatabaseLib.entityHeight(entities[i]);
				if (maxX > workspaceSize.width) {
					workspaceSize.width = maxX;
				}
				if (maxY > workspaceSize.height) {
					workspaceSize.height = maxY;
				}
			}
		}
		return workspaceSize;
	}

	static isAvailableSpace(entities, entity, pX, pY) {
		const elemWidth = DatabaseLib.entityWidth(entity);
		const elemHeight = DatabaseLib.entityHeight(entity);
		for (const i in entities) {
			if (entities[i].x != -1 && entities[i].y != -1) {
				if (
					entities[i].x > pX - DatabaseLib.entityWidth(entities[i]) &&
					entities[i].x < pX + elemWidth &&
					entities[i].y > pY - DatabaseLib.entityHeight(entities[i]) &&
					entities[i].y < pY + elemHeight
				) {
					return false;
				}
			}
		}
		return true;
	}

	// ui storage functions

	static loadUi(p, entities, entityName) {
		const ui = {
			x: -1,
			y: -1
		};

		const workspaceSize = DatabaseLib.getWorkspaceSize(entities);
		if (workspaceSize.height >= workspaceSize.width) {
			ui.y = 0;
			ui.x = workspaceSize.width + DatabaseLib.entitySpacing * 2;
		} else {
			let posX = 0;
			let posY = 1e10;
			for (const i in entities) {
				if (entities[i].x != -1 && entities[i].y != -1) {
					const pX = entities[i].x;
					const pY =
						entities[i].y + DatabaseLib.entityHeight(entities[i]);
					if (
						pY < posY &&
						DatabaseLib.isAvailableSpace(entities, entities[i], pX, pY)
					) {
						posX = pX;
						posY = pY;
					}
				}
			}
			ui.x = posX;
			if (posY > 1e9) {
				ui.y = 0;
			} else {
				ui.y = posY + DatabaseLib.entitySpacing * 2;
			}
		}

		return ui;
	}

}