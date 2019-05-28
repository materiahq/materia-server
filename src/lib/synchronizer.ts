import * as Sequelize from 'sequelize';
import { IDatabaseDiffs, IRelation, IApplyOptions, IActionData } from '@materia/interfaces';

import { App } from './app';
import { MigrationType } from './history';
import { DBEntity } from './entities/db-entity';
import { Entity } from './entities/entity';

export class Synchronizer {

	constructor(private app: App) {}

	diff(): Promise<IDatabaseDiffs> {
		return this.app.database.interface.showTables().then((dbTables) => {
			const entities = this.app.entities.findAll().filter((entity: Entity): entity is DBEntity => entity instanceof DBEntity);
			const diffs = this._diffMap(entities, dbTables);
			return Promise.resolve(diffs);
		});
	}

	entitiesToDatabase(diffs: IDatabaseDiffs, options?: IApplyOptions): Promise<IActionData[]> {
		options = Object.assign({}, options || {});
		options.history = false;
		options.apply = false;
		options.save = false;

		const actions = [];
		for (const type of ['relations', 'fields', 'entities']) {
			for (const action of diffs[type]) {
				actions.push(action);
			}
		}
		return this.app.history.revert(actions, options);
	}

	databaseToEntities(diffs: IDatabaseDiffs, options?: IApplyOptions): Promise<IActionData[]> {
		options = Object.assign({}, options || {});
		options.history = false;
		options.db = false;

		let actions = [];
		actions = this._constructEntitiesDiffs(diffs['entities']);
		for (const type of ['fields', 'relations']) {
			for (const action of diffs[type]) {
				actions.push(action);
			}
		}
		return this.app.history.apply(actions, options)
			.then(() => this.app.entities.sync())
			.then(() => actions);
	}

	private _compareField(dbfield, field, entity): any {
		const props = ['name', 'type', 'primary', 'required', 'autoIncrement', 'default', 'defaultValue', 'onUpdate', 'onDelete'];
		const diff = [{}, {}] as any;
		let found = false;

		if (field.defaultValue === Sequelize.NOW) {
			field.defaultValue = 'now()';
		}

		if (
			this.app.database && this.app.database.type === 'sqlite' &&
			field.isRelation && field.isRelation.type === 'belongsTo' && dbfield.default
		) {
			if ( ! field.onDelete || field.onDelete && field.onDelete.toUpperCase() === 'CASCADE') {
				field.default = true;
				field.defaultValue = dbfield.number ? parseInt(dbfield.defaultValue, 10) : dbfield.defaultValue;
			}
		}

		for (const k of props) {
			if (Array.isArray(dbfield[k])) {
				if (dbfield[k].indexOf(field[k]) == -1) {
					diff[0][k] = dbfield[k][0];
					diff[1][k] = field[k];
					found = true;
				}
			} else if (
				dbfield[k] != field[k] &&
				(k != 'defaultValue' || (new Date(dbfield[k])).getTime() != (new Date(field[k])).getTime())
			) {
				diff[0][k] = dbfield[k];
				diff[1][k] = field[k];
				found = true;
			}
		}

		if (
			dbfield.unique !== field.unique &&
			! dbfield.primary &&
			! field.primary &&
			! (dbfield.unique === true &&
			(typeof field.unique == 'string') &&
			entity.getUniqueFields(field.unique).length == 1)
		) {
			diff[0].unique = dbfield.unique;
			diff[1].unique = field.unique;
			found = true;
		} else if (dbfield.primary && dbfield.number && dbfield.autoIncrement) {
			diff[0].unique = true;
		}

		if ( ! found) {
			return false;
		}
		return diff;
	}

	private _constructEntitiesDiffs(entitiesDiffs: IDatabaseDiffs['entities']) {
		let result = [];
		if (entitiesDiffs && entitiesDiffs.length) {
			const entitiesWithoutRelationsDiffs = entitiesDiffs.filter(diff =>
				diff.redo &&
				diff.redo.type === MigrationType.CREATE_ENTITY &&
				diff.redo.value &&
				(! diff.redo.value.relations || (diff.redo.value.relations
				&& diff.redo.value.relations.length === 0))
			);
			const entitiesWithRelationsDiffs = entitiesDiffs.filter(diff =>
				diff.redo &&
				diff.redo.type === MigrationType.CREATE_ENTITY &&
				diff.redo.value &&
				diff.redo.value.relations &&
				diff.redo.value.relations.length > 0
			);
			result = this._sortCreateEntitiesDiffsWithRelations(entitiesWithRelationsDiffs, entitiesWithoutRelationsDiffs);
			const otherEntitiesDiffs = entitiesDiffs.filter(diff =>
				! diff.redo || (
				diff.redo &&
				diff.redo.type !== MigrationType.CREATE_ENTITY
				)
			);
			result = [...result, ...otherEntitiesDiffs];
		}
		return result;
	}

	private _sortCreateEntitiesDiffsWithRelations(
		entitiesWithRelationsDiffs: IDatabaseDiffs['entities'],
		loadedDiffs: IDatabaseDiffs['entities']
	) {
		let finish = true;
		entitiesWithRelationsDiffs.forEach(diff => {
			const relatedEntities = diff.redo.value.relations.map((relation: IRelation) => relation.reference.entity);
			const alreadyLoadedEntitiesInDiffs = loadedDiffs.map(d => d.redo.value.name);
			const alreadyLoadedEntities = [...this.app.entities.findAll().map(e => e.name), ...alreadyLoadedEntitiesInDiffs];
			let missing = false;
			relatedEntities.forEach(entityName => {
				if (alreadyLoadedEntities.indexOf(entityName) === -1 && entityName !== diff.redo.table) {
					missing = true;
				}
			});
			if ( ! missing && alreadyLoadedEntities.indexOf(diff.redo.value.name) === -1) {
				finish = false;
				loadedDiffs.push(diff);
			}
		});
		if (finish) {
			return loadedDiffs;
		} else {
			return this._sortCreateEntitiesDiffsWithRelations(entitiesWithRelationsDiffs, loadedDiffs);
		}
	}

	private _compareRelation(rel1, rel2) {
		return rel1.entity != rel2.entity || rel2.field != rel2.field;
	}

	private _diffRelation(entity, dbField, field, diffs) {
		if (dbField.fk) {
			if (dbField.unique && entity.isRelation) {
				return true;
			}
			const relations = entity.getRelations();
			let found = false;
			for (const relation of relations) {
				if (relation.field != dbField.name) {
					continue;
				}
				found = true;
				if (this._compareRelation(relation.reference, dbField.fk)) {
					// delete and create relation field.fk
					diffs.relations.push({
						redo: {
							type: MigrationType.DELETE_RELATION,
							table: entity.name,
							value: relation,
						},
						undo: {
							type: MigrationType.ADD_RELATION,
							table: entity.name,
							value: relation
						}
					});
					diffs.relations.push({
						redo: {
							type: MigrationType.ADD_RELATION,
							table: entity.name,
							value: {
								field: dbField.name,
								reference: dbField.fk
							},
						},
						undo: {
							type: MigrationType.DELETE_RELATION,
							table: entity.name,
							value: {
								field: dbField.name,
								reference: dbField.fk
							}
						}
					});
				} else if (field) {
					const fieldDiff = this._compareField(dbField, field, entity);
					if ( fieldDiff ) {
						// the field has custom properties so add to fields or revert on db.
						dbField.read = field.read;
						dbField.write = field.write;
						diffs.fields.push({
							redo: {
								type: MigrationType.CHANGE_FIELD,
								table: entity.name,
								name: dbField.name,
								value: this.app.database.interface.flattenField(dbField)
							},
							undo: {
								type: MigrationType.CHANGE_FIELD,
								table: entity.name,
								name: field.name,
								value: fieldDiff[1]
							}
						});
					}
				}
			}
			if ( ! found) {
				diffs.relations.push({
					redo: {
						type: MigrationType.ADD_RELATION,
						table: entity.name,
						value: {
							field: dbField.name,
							reference: dbField.fk
						},
					},
					undo: {
						type: MigrationType.DELETE_RELATION,
						table: entity.name,
						value: {
							field: dbField.name,
							reference: dbField.fk
						}
					}
				});
			}
			return true;
		} else if (field) {
			// if a field is a relation and a simple field in db
			if (field.isRelation) {
				diffs.relations.push({
					redo: {
						type: MigrationType.DELETE_RELATION,
						table: entity.name,
						value: field.isRelation
					},
					undo: {
						type: MigrationType.ADD_RELATION,
						table: entity.name,
						value: field.isRelation
					}
				});
				diffs.fields.push({
					redo: {
						type: MigrationType.ADD_FIELD,
						table: entity.name,
						value: field.toJson()
					},
					undo: {
						type: MigrationType.DELETE_FIELD,
						table: entity.name,
						value: field.name
					}
				});
				return true;
			}
		}
		return false;
	}

	private _diffEntity(entity, dbTable, diffs) {
		const dbFields = {};
		const isRelationTable = [];
		for (const _dbField of dbTable) {
			if ( _dbField.fk && _dbField.unique) {
				isRelationTable.push({
					as: _dbField.name,
					entity: _dbField.fk.entity
				});
			}
		}

		if (isRelationTable.length == 2 && ( ! entity.isRelation || entity.getFields().length < 2)) {
			// add relations belongsToMany
			diffs.relations.push({
				redo: {
					type: MigrationType.ADD_RELATION,
					table: isRelationTable[0].entity,
					value: {
						type: 'belongsToMany',
						through: entity.name,
						as: isRelationTable[0].as,
						reference: isRelationTable[1]
					}
				},
				undo: {
					type: MigrationType.DELETE_RELATION,
					table: isRelationTable[0].entity,
					value: {
						type: 'belongsToMany',
						through: entity.name,
						as: isRelationTable[0].as,
						reference: isRelationTable[1]
					}
				}
			});
			diffs.relations.push({
				redo: {
					type: MigrationType.ADD_RELATION,
					table: isRelationTable[1].entity,
					value: {
						type: 'belongsToMany',
						through: entity.name,
						as: isRelationTable[1].as,
						reference: isRelationTable[0]
					}
				},
				undo: {
					type: MigrationType.DELETE_RELATION,
					table: isRelationTable[1].entity,
					value: {
						type: 'belongsToMany',
						through: entity.name,
						as: isRelationTable[1].as,
						reference: isRelationTable[0]
					}
				}
			});
		}

		for (const _dbField of dbTable) {
			const dbField = this.app.database.interface.columnToField(_dbField);
			dbField.fk = _dbField.fk;
			dbFields[dbField.name] = dbField;
			const field = entity.getField(dbField.name);

			if (isRelationTable.length != 2 && this._diffRelation(entity, dbField, field, diffs)) {
				continue;
			}

			if (field) {
				const fieldDiff = this._compareField(dbField, field, entity);
				if (fieldDiff[0] && ! fieldDiff[0].fk) {
					// update field to db properties
					dbField.read = field.read;
					dbField.write = field.write;
					diffs.fields.push({
						redo: {
							type: MigrationType.CHANGE_FIELD,
							table: entity.name,
							name: dbField.name,
							value: fieldDiff[0]
						},
						undo: {
							type: MigrationType.CHANGE_FIELD,
							table: entity.name,
							name: field.name,
							value: fieldDiff[1]
						}
					});
				}
			} else if ( ! dbField.fk) {
				// add field that are in db
				diffs.fields.push({
					redo: {
						type: MigrationType.ADD_FIELD,
						table: entity.name,
						value: this.app.database.interface.flattenField(dbField)
					},
					undo: {
						type: MigrationType.DELETE_FIELD,
						table: entity.name,
						value: dbField.name
					}
				});
			}
		}

		// delete fields that are not in db
		for (const field of entity.getFields()) {
			if ( ! dbFields[field.name] && ! field.isRelation) {
				diffs.fields.push({
					redo: {
						type: MigrationType.DELETE_FIELD,
						table: entity.name,
						value: field.name
					},
					undo: {
						type: MigrationType.ADD_FIELD,
						table: entity.name,
						value: field.toJson()
					}
				});
			}
		}

		// delete relations that are not in db
		for (const relation of entity.getRelations()) {
			if ( ! dbFields[relation.field] && relation.type == 'belongsTo' && ! relation.implicit) {
				// delete relation
				diffs.relations.push({
					redo: {
						type: MigrationType.DELETE_RELATION,
						table: entity.name,
						value: relation,
					},
					undo: {
						type: MigrationType.ADD_RELATION,
						table: entity.name,
						value: relation
					}
				});
			}
		}
	}


	private _diffEntities(entities, dbTables, diffs) {
		const tableCompared = [];
		for (const entity of entities) {
			tableCompared[entity.name] = entity;
			if (dbTables[entity.name]) {
				// compare fields
				this._diffEntity(entity, dbTables[entity.name], diffs);
			} else if (entity.isRelation) {
				let relation = {
					type: 'belongsToMany',
					through: entity.name,
					as: entity.isRelation[0].as,
					reference: {
						entity: entity.isRelation[1].entity,
						as: entity.isRelation[1].as
					}
				};
				diffs.relations.push({
					redo: {
						type: MigrationType.DELETE_RELATION,
						table: entity.isRelation[0].entity,
						value: relation
					},
					undo: {
						type: MigrationType.ADD_RELATION,
						table: entity.isRelation[0].entity,
						value: relation
					}
				});

				relation = {
					type: 'belongsToMany',
					through: entity.name,
					as: entity.isRelation[1].as,
					reference: {
						entity: entity.isRelation[0].entity,
						as: entity.isRelation[0].as
					}
				};
				diffs.relations.push({
					redo: {
						type: MigrationType.DELETE_RELATION,
						table: entity.isRelation[1].entity,
						value: relation
					},
					undo: {
						type: MigrationType.ADD_RELATION,
						table: entity.isRelation[1].entity,
						value: relation
					}
				});
			} else {
				diffs.entities.push({
					redo: {
						type: MigrationType.DELETE_ENTITY,
						table: entity.name
					},
					undo: {
						type: MigrationType.CREATE_ENTITY,
						table: entity.name,
						value: entity.toJson()
					}
				});
			}
		}

		for (const table in dbTables) {
			// if table exists in db but not in entities
			if ( ! tableCompared[table]) {
				const fields = [];
				let relations = [];
				let isRelation = [];
				for (const field of dbTables[table]) {
					if ( field.fk ) {
						const relation: IRelation = {
							field: field.name,
							reference: field.fk
						};
						if (field.unique) {
							if (field.unique === true) {
								relation.unique = true;
							}
							isRelation.push({
								field: field.name,
								entity: field.fk.entity
							});
						}
						relations.push(relation);
						if ((field.onDelete !== 'CASCADE') || (field.onUpdate !== 'CASCADE')) {
							if ( ! field.onDelete) {
								field.onDelete = 'NO ACTION';
							}
							if ( ! field.onUpdate) {
								field.onUpdate = 'NO ACTION';
							}
							fields.push(this.app.database.interface.flattenField(this.app.database.interface.columnToField(field)));
						}
					} else {
						fields.push(this.app.database.interface.flattenField(this.app.database.interface.columnToField(field)));
					}
				}

				if (isRelation.length != 2) {
					isRelation = undefined;
				} else {
					relations = undefined;
					let relation = {
						type: 'belongsToMany',
						through: table,
						as: isRelation[0].field,
						reference: {
							entity: isRelation[1].entity,
							as: isRelation[1].field
						}
					};
					diffs.relations.push({
						redo: {
							type: MigrationType.ADD_RELATION,
							table: isRelation[0].entity,
							value: relation
						}, undo: {
							type: MigrationType.DELETE_RELATION,
							table: isRelation[0].entity,
							value: relation
						}
					});

					relation = {
						type: 'belongsToMany',
						through: table,
						as: isRelation[1].field,
						reference: {
							entity: isRelation[0].entity,
							as: isRelation[0].field
						}
					};
					diffs.relations.push({
						redo: {
							type: MigrationType.ADD_RELATION,
							table: isRelation[1].entity,
							value: relation
						}, undo: {
							type: MigrationType.DELETE_RELATION,
							table: isRelation[1].entity,
							value: relation
						}
					});
				}

				const tableDesc = {
					name: table,
					fields: fields,
					queries: [],
					isRelation: isRelation,
					relations: relations
				};

				diffs.entities.push({
					redo: {
						type: MigrationType.CREATE_ENTITY,
						table: table,
						value: tableDesc
					},
					undo: {
						type: MigrationType.DELETE_ENTITY,
						table: table
					}
				});
			}
		}
	}

	private _diffMap(entities, dbTables) {
		const diffs = {
			entities: [],
			fields: [],
			relations: [],
			length: 0
		};

		this._diffEntities(entities, dbTables, diffs);

		diffs.length = diffs.entities.length + diffs.fields.length + diffs.relations.length;
		return diffs;
	}
}