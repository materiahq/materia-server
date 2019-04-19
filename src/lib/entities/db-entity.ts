import { IEntityConfig, IField, IFieldUpdate } from '@materia/interfaces';

import { Entity } from './entity';
import { MateriaError } from '../error';

import { App } from '../app';
import { Field } from './field';

import { ModelStatic } from '../database/interface';
import { QueryGenerator } from './query-generator';
import { FindAllQuery } from './queries/findAll';
import { FindOneQuery } from './queries/findOne';
import { CreateQuery } from './queries/create';
import { UpdateQuery } from './queries/update';
import { DeleteQuery } from './queries/delete';
import { SQLQuery } from './queries/sql';
import { CustomQuery } from './queries/custom';
import { BelongsToManyOptions } from 'sequelize/types';

export class DBEntity extends Entity {
	type: string;
	currentDiff: Array<any>;
	currentDiffUndo: Array<any>;
	public model: ModelStatic;

	reservedQueries = [
		'create', 'list', 'get', 'update', 'delete'
	];

	constructor(app: App) {
		super(app, {
			findAll: FindAllQuery,
			findOne: FindOneQuery,
			create: CreateQuery,
			update: UpdateQuery,
			delete: DeleteQuery,
			custom: CustomQuery,
			sql: SQLQuery
		});

		this.type = 'db';

		this.currentDiff = [];
		this.currentDiffUndo = [];
	}

	updatePrimary(field, fieldobj, options): Promise<any> {
		let pks = this.getPK();
		let p: Promise<any> = Promise.resolve();

		let restore_ai: any = false;

		// For mysql, it needs to remove auto increment before dropping pk
		if (this.app.database.type == 'mysql') {
			for (const pk of pks) {
				if (pk.autoIncrement) {
					const pkcpy: IFieldUpdate = Object.assign({}, pk);
					pkcpy.autoIncrement = false;
					restore_ai = pk.name;
					p = this.updateField(pk.name, pkcpy, options);
				}
			}
		}

		// remove PK constraint
		if (pks.length) {
			const pk_name = pks[0].name;
			p = p.then(() => {
				return this.app.database.interface.dropConstraint(this.name, { field: pk_name, type: 'primary' });
			});
		}

		// add or remove field in PK
		if (field.primary) {
			if (!pks.find(x => x.name == fieldobj.name)) {
				pks.push(fieldobj);
			}
			if (field.unique) {
				delete field.unique;
			}
		} else {
			pks = pks.filter(x => x.name != fieldobj.name);
			if (field.unique == undefined) {
				field.unique = true;
			}
			if (field.unique == false) {
				delete field.unique;
			}
		}

		// reconstruct PK constraint
		if (pks.length) {
			const pks_names = pks.map(x => x.name);
			p = p.then(() => {
				return this.app.database.interface.addConstraint(this.name, { fields: pks_names, type: 'primary' });
			});
		}

		// restore auto increment for mysql, if it's still in pk
		if (this.app.database.type == 'mysql' && restore_ai) {
			if (pks.find(x => x.name == restore_ai)) {
				p = p.then(() => {
					const pk = this.getField(restore_ai);
					const pkcpy: IFieldUpdate = Object.assign({}, pk);
					pkcpy.autoIncrement = true;
					p = this.updateField(pk.name, pkcpy, options);
				});
			} else {
				if (restore_ai == fieldobj.name) {
					p = p.then(() => {
						fieldobj.autoIncrement = false;
					});
				}
			}
		}

		delete field.primary;
		return p;
	}

	updateUnique(field, fieldobj) {
		let constraint_name;
		let uniqueFields = [];
		let p;

		// remove field from unique constraints
		p = this.app.database.interface.dropConstraint(this.name, { field: fieldobj.name, type: 'unique' });

		if (typeof field.unique == 'string') {
			// remove unique constraint group
			uniqueFields = this.getUniqueFields(field.unique);
			constraint_name = field.unique;
			p = p.then(() => { return this.app.database.interface.dropConstraint(this.name, { name: constraint_name, type: 'unique' }); });
		}

		// add or remove field in constraint
		if (field.unique) {
			if (!uniqueFields.find((x) => { return x.name == fieldobj.name; })) {
				uniqueFields.push(fieldobj);
			}
		} else {
			if (uniqueFields.length) {
				uniqueFields = uniqueFields.filter((x) => { return x.name != fieldobj.name; });
			}
		}

		// reconstruct unique constraint
		if (uniqueFields.length) {
			const unique_names = uniqueFields.map((x) => { return x.name; });
			p = p.then(() => {
				return this.app.database.interface.addConstraint(this.name, { fields: unique_names, name: constraint_name, type: 'unique' });
			});
		}

		return p;
	}

	updateField(name: string, field: IFieldUpdate, options?): Promise<Field> {
		options = options || {};

		const oldfield = this.getField(name);

		return new Promise((accept, reject) => {
			if ( ! oldfield) {
				return reject(new MateriaError('This field does not exist'));
			}


			let fieldobj: Field;

			let differ_done;
			options.differ = (done) => {
				differ_done = done;
			};

			const _field: IFieldUpdate = Object.assign({}, oldfield, field);

			if (_field.autoIncrement && _field.type.toLowerCase() != 'number') {
				delete _field.autoIncrement;
				delete field.autoIncrement;
			}

			super.updateField(name, _field, options).then((_fieldobj) => {
				fieldobj = _fieldobj;
				if (options.db == false) {
					differ_done();
					throw null;
				}

				if (options.apply != false) {
					if (field.type == oldfield.type) {
						delete field.type;
					}
					if (field.unique == oldfield.unique) {
						delete field.unique;
					}
					if (field.required == oldfield.required) {
						delete field.required;
					}
					if (field.primary == oldfield.primary) {
						delete field.primary;
					}
					if (field.default == oldfield.default) {
						delete field.default;
					}
					if (field.autoIncrement == oldfield.autoIncrement) {
						delete field.autoIncrement;
					}
					if (field.defaultValue == oldfield.defaultValue) {
						delete field.defaultValue;
					}
					if (field.onUpdate == oldfield.onUpdate) {
						delete field.onUpdate;
					}
					if (field.onDelete == oldfield.onDelete) {
						delete field.onDelete;
					}
				}

				if (oldfield.name != fieldobj.name) {
					return this.app.database.interface.renameColumn(
						this.name, oldfield.name,
						fieldobj.name
					);
				}
			}).then(() => {
				if (field.primary != undefined) {
					return this.updatePrimary(field, fieldobj, options);
				}
			}).then(() => {
				if ( field.unique != undefined && ! fieldobj.primary ) {
					return this.updateUnique(field, fieldobj);
				}
			}).then(() => {
				delete field.unique;
				if (oldfield.isRelation) {
					field.isRelation = oldfield.isRelation;
				}
				if (field.references === null || field.isRelation) {
					return this.app.database.interface.dropConstraint(this.name, { field: fieldobj.name, type: 'references' });
				}
			}).then(() => {
				let dbfield = this.app.database.interface.fieldToColumn(field);
				if (Object.keys(dbfield).length == 0) {
					return Promise.resolve();
				}

				// sequelize changeColumn must constain type and nullable
				if ( ! dbfield.type ) {
					field.type = oldfield.type;
				}
				if (dbfield.allowNull == undefined) {
					field.required = oldfield.required;
				}
				if (dbfield.default == undefined) {
					field.default = oldfield.default;
				}
				if (field.default && dbfield.defaultValue == undefined) {
					field.defaultValue = oldfield.defaultValue;
				}
				if (dbfield.onUpdate || dbfield.onDelete) {
					field.onUpdate = dbfield.onUpdate;
					field.onDelete = dbfield.onDelete;
				}

				let p: Promise<any> = Promise.resolve();
				if (field.required && ! field.default && field.defaultValue) {
					p = p.then(() => {
						field.default = true;
						field.required = false;
						dbfield = this.app.database.interface.fieldToColumn(field);
						field.default = false;
						field.required = true;
						delete field.defaultValue;

						const vals = {};
						const where = {};
						vals[fieldobj.name] = dbfield.defaultValue;
						where[fieldobj.name] = null;
						return this.model.update(vals, { where: where });
					});
				}
				return p.then(() => {
					return this.app.database.interface.changeColumn(this.name, fieldobj.name, field);
				});
			}).then(() => {
				differ_done();

				if (options.apply != false) {
					let p = this.loadModel().then(() => {
						this.loadRelationsInModel();
						this.refreshQueries();
					});
					if (field.name != oldfield.name) {
						for (const entity of this.app.entities.findAll()) {
							let need_save = false;
							for (const relation of entity.relations) {
								if (relation.reference && relation.reference.entity == this.name && relation.reference.field == oldfield.name) {
									need_save = true;
									relation.reference.field = field.name;
								}
							}
							if (need_save) {
								if (options.save != false) {
									p = p.then(() => entity.save());
								}
								p = p.then(() => {
									return entity.loadModel().then(() => {
										entity.loadRelationsInModel();
									});
								});
							}
						}
					}
					return p;
				}
			}).then(() => {
				accept(fieldobj);
			}).catch((err) => {
				if (err == null && options.db == false) {
					return accept(fieldobj);
				}
				reject(err);
			});
		});
	}

	addFieldAt(field: IField, at: number, options?): Promise<Field> {
		options = options || {};

		field = Object.assign({}, field);

		if (field.autoIncrement && field.type.toLowerCase() != 'number') {
			delete field.autoIncrement;
		}
		const newOpts = field.generateFrom ? Object.assign({}, options, {
			generateQueries: false
		}) : options;

		// await promise;
		return super.addFieldAt(field, at, newOpts).then((fieldobj) => {
			if (options.db == false) {
				return Promise.resolve(fieldobj);
			}

			let p = Promise.resolve();
			if (options.apply != false) {
				p = this.loadModel().then(() => {
					this.loadRelationsInModel();
				});
			}

			const isUnique = field.unique;
			field.unique = false;

			// When field is required and doesn't have default value
			// if it has data in the entity, it will make an error because the field can't be null and we don't know what do put into
			if (field.required && ! field.default) {
				field.default = true;
				if (field.generateFrom) {
					p = p.then(() => {
						const entityFrom = this.app.entities.get(field.generateFrom);
						const entityFromPk = entityFrom.getPK()[0];
						return entityFrom.getQuery('list').run({ limit: 1 }, {raw: true}).then((list) => {
							if ( ! list.data.length) {
								const query: any = this.getQuery('list');
								query.select = query.select.filter(fieldName => fieldName !== field.name);
								return query.run({ limit: 1 }).then((from_list) => {
									if (from_list.data.length) {
										field.required = false;
										field.default = false;
										field.onDelete = 'NO ACTION';
										const fieldInstance = this.getField(field.name);
										fieldInstance.update(
											Object.assign({},
											fieldInstance.toJson(),
											{
												onDelete: 'NO ACTION',
												required: false,
												default: false,
												unique: isUnique,
												primary: false,
												autoIncrement: false
											}
										));
									} else {
										delete field.defaultValue;
									}
								});
							} else {
								field.defaultValue = list.data[0][entityFromPk.name];
							}
						});
					});
				}
				p = p.then(() => {
					if (field.defaultValue == undefined) {
						const defs = {
							'number' : 0,
							'text': '',
							'string' : '',
							'float': 0,
							'boolean': false,
							'date': new Date(0)
						};
						field.defaultValue = defs[field.type] === undefined ? '' : defs[field.type];
					}

					return this.app.database.interface.addColumn(this.name, field.name, field);
				});
				if (field.required) {
					p = p.then(() => {
						field.default = false;
						delete field.defaultValue;
						delete field.isRelation;
						return this.app.database.interface.changeColumn(this.name, field.name, field);
					});
				}
			} else {
				p = p.then(() => {
					return this.app.database.interface.addColumn(this.name, field.name, field);
				});
			}

			if (options.apply != false) {
				this.generateDefaultQueries();
				this.refreshQueries();
			}

			if (isUnique) {
				p = p.then(() => {
					field.unique = true;
					return this.updateUnique(field, fieldobj);
				});
			}

			return p.then(() => {
				return fieldobj;
			});
		}).catch((e) => {
			return this.removeField(field.name, options).catch(() => {}).then(() => {
				throw e;
			});
		});
	}

	removeField(field, options) {
		options = options || {};

		return super.removeField(field, options).then(() => {
			if (options.db == false) {
				return Promise.resolve();
			}

			let p = Promise.resolve();
			if (options.apply != false) {
				p = this.loadModel().then(() => {
					this.loadRelationsInModel();
					this.refreshQueries();
				});
			}

			p = p.then(() => {
				const fieldobj = { name: field, unique: false };
				return this.updateUnique(fieldobj, fieldobj);
			});

			p = p.then(() => {
				return this.app.database.interface.removeColumn(this.name, field);
			});

			return p;
		});
	}

	generateDefaultQueries() {
		const qg = new QueryGenerator(this);
		qg.generateQueries();
	}

	loadModel(): Promise<void> {
		const idField = this.getField('id');
		let idPKforce = false;
		if (idField && ! this.getPK().length) {
			idPKforce = true;
			idField.primary = true;
		}
		try {
			this.model = this.app.database.interface.define(this);
		} catch (e) {
			return Promise.reject(e);
		}
		if (idPKforce) {
			idField.primary = false;
		}
		if ( ! idField && this.model.rawAttributes.id) {
			this.model.removeAttribute('id');
		}
		return Promise.resolve();
	}

	loadRelationsInModel(): void {
		this.relations.forEach(relation => {
			const entityDest = this.app.entities.get(relation.reference.entity);
			if (entityDest && entityDest instanceof DBEntity) {
				// @model.hasMany entityDest.model, relation.dstField if relation.type == '1-n' and relation.cardinality == '1'
				if ( ! relation.type || relation.type == 'belongsTo') {
					/*console.log(this.name + ' belongs to ' + entityDest.name + ' with fk: ' + relation.field)
					//entityDest.model.belongsTo @model, foreignKey: relation.dstField
					let keyReference = entityDest.getPK()
					if (relation.reference.field && relation.reference.field != keyReference.name) {
						let f = entityDest.getField(relation.reference.field)
						if ( ! f.unique) {
							throw f.name + ' cannot be a key (need unique/primary field)'
						}
						keyReference = f
					}*/
					let key = entityDest.getPK()[0].name;
					if (relation.reference.field) {
						key = relation.reference.field;
					}

					this.model.belongsTo(entityDest.model, { foreignKey: relation.field, targetKey: key });
					entityDest.model.hasMany(this.model, { foreignKey: relation.field });
				} else if (relation.type == 'hasMany') {
					let key = this.getPK()[0].name;
					if (relation.field) {
						key = relation.field;
					}

					entityDest.model.belongsTo(this.model, { foreignKey: relation.reference.field, targetKey: key });
					this.model.hasMany(entityDest.model, { foreignKey: relation.reference.field });
				} else if (relation.type == 'belongsToMany') {
					const entityThrough = this.app.entities.get(relation.through) as DBEntity;
					if ( ! entityThrough) {
						console.error('Through table not found');
					} else {
						const relationModel: BelongsToManyOptions = {
							through: {
								model: entityThrough.model
							},
							foreignKey: relation.as,
							otherKey: relation.reference.as
						};
						if (this.model.getTableName() === entityDest.model.getTableName()) {
							relationModel.as = entityThrough.model + Math.random().toString();
						}
						this.model.belongsToMany(entityDest.model, relationModel);
					}
				}
			}
		});
	}

	toJson(): IEntityConfig {
		const json = super.toJson();
		json.queries = json.queries.filter(query => ['get', 'list', 'update', 'create', 'delete'].indexOf(query.id) == -1);
		return json;
	}
}