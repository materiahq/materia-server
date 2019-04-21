import * as fs from 'fs';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import chalk from 'chalk';
import { IEntityConfig, IRelation, IQuery, IField, IApplyOptions, IFieldUpdate } from '@materia/interfaces';

import { App } from '../app';
import { MateriaError } from '../error';
import { MigrationType } from '../history';
import { Addon } from '../addons/addon';

import { Field } from './field';
import { Query, IQueryConstructor } from './query';
import { ConfigType } from '../config';

/**
 * @class Entity
 * @classdesc
 * An entity, in a database this correspond to a table.
 */
export abstract class Entity {
	relations_queue: Array<{relation: IRelation, options: IApplyOptions}>;
	queryObjects: any;

	id: string;
	name: string;

	x: number;
	y: number;

	isRelation: any;

	fields: Array<Field>;
	relations: Array<IRelation>;
	queries: Array<Query>;

	fromAddon: Addon;

	abstract model: any;
	abstract reservedQueries: string[];

	constructor(public app: App, queryTypes) {
		this.relations_queue = [];
		this.queryObjects = {};

		if (queryTypes) {
			this.defineQueryObjects(queryTypes);
		}
	}

	abstract generateDefaultQueries();

	fixIsRelation(options?: IApplyOptions): Promise<void> {
		if ( ! this.isRelation) {
			return Promise.resolve();
		}
		const entity1 = this.app.entities.get(this.isRelation[0].entity);
		const entity2 = this.app.entities.get(this.isRelation[1].entity);

		let p = Promise.resolve();
		if ( ! entity1 || ! entity2) { // converts to / keep belongsTo relations
			const pk1 = entity1 && entity1.getPK()[0];
			if (pk1) {
				const rel = {
					type: 'belongsTo',
					field: this.isRelation[0].field,
					reference: {
						entity: entity1.name,
						field: pk1.name
					}
				};
				if (entity1.getRelationIndex(rel) == -1) {
					p = p.then(() => this.addRelation(rel, options));
				}
			}
			const pk2 = entity2 && entity2.getPK()[0];
			if (pk2) {
				const rel = {
					type: 'belongsTo',
					field: this.isRelation[1].field,
					reference: {
						entity: entity2.name,
						field: pk2.name
					}
				};
				if (entity2.getRelationIndex(rel) == -1) {
					p = p.then(() => this.addRelation(rel, options));
				}
			}
			delete this.isRelation;
		} else { // add missing belongsToMany relations in related entities
			const rel1 = {
				type: 'belongsToMany',
				through: this.name,
				as: this.isRelation[0].field,
				reference: {
					entity: entity2.name,
					as: this.isRelation[1].field
				}
			};
			if (entity1.getRelationIndex(rel1) == -1) {
				p = p.then(() => entity1.addRelation(rel1, options));
			}

			const rel2 = {
				type: 'belongsToMany',
				through: this.name,
				as: this.isRelation[1].field,
				reference: {
					entity: entity1.name,
					as: this.isRelation[0].field
				}
			};
			if (entity2.getRelationIndex(rel2) == -1) {
				p = p.then(() => entity2.addRelation(rel2, options));
			}
		}
		return p;
	}

	move(x, y): Promise<void> {
		this.x = x;
		this.y = y;
		return this.savePosition();
	}

	create(entityobj, options) {
		options = options || {};

		this.name = entityobj.name;
		this.id = entityobj.id || uuid();
		if (entityobj.x && entityobj.y) {
			this.x = entityobj.x;
			this.y = entityobj.y;
		} else {
			this.app.config.reloadConfig();
			const entityPosition = this.app.config.entitiesPosition[entityobj.name];
			if (entityPosition) {
				this.x = entityPosition.x;
				this.y = entityPosition.y;
			}
		}
		this.fields = [];
		this.relations = [];
		this.queries = [];
		this.isRelation = entityobj.isRelation;
		this.fromAddon = options.fromAddon;

		const promises = [];

		if (entityobj.fields) {
			entityobj.fields.forEach((field) => {
				promises.push(this.addField(field, {history: false, save: false, db: false, generateQueries: false}));
			});
		}

		if (entityobj.relations) {
			entityobj.relations.forEach((relation) => {
				if (options.wait_relations) {
					this.relations_queue.push({relation: relation, options: {history: false, save: false, db: false}});
				} else {
					promises.push(this.addRelation(relation, {history: false, save: false, db: false}));
				}
			});
		}

		return Promise.all(promises);
	}

	loadQueries(queries: Array<IQuery>): void {
		this.generateDefaultQueries();
		if (queries) {
			queries.forEach((query) => {
				// fix: don't overload default query else it always overload after the first generation
				if (this.reservedQueries.indexOf(query.id) == -1) {
					try {
						this.app.logger.log(` │ │ └── ${chalk.bold(this.name)}.${chalk.bold(query.id)}`);
						this.addQuery(query, {history: false, save: false});

					} catch (e) {
						const err = e.originalError || e instanceof MateriaError && e;
						if (err) {
							this.app.logger.warn(` │ │ │   (Warning) Skipped query "${query.id}" of entity "${this.name}"`);
							this.app.logger.warn(' │ │ │   due to error: ' + err.stack);
						} else {
							throw e;
						}
					}
				}
			});
		}
	}

	applyRelations() {
		const promises = [];
		for (const relobj of this.relations_queue) {
			if (this.app.entities.get(relobj.relation.reference.entity)) {
				promises.push(this.addRelation(relobj.relation, relobj.options).catch((e) => {
					this.app.logger.warn(`In ${this.name}: ${e && e.message}. Skipped relation`);
					return Promise.resolve();
				}));
			}
		}
		this.relations_queue = [];
		return Promise.all(promises).then(() => {
			this.refreshQueries();
		});
	}

	save(): Promise<void> {
		if (this.fromAddon) {
			return Promise.resolve();
		} else {
			const relativePath = path.join('server', 'models', this.name + '.json');
			const entityModel = Object.assign({}, this.toJson());
			delete entityModel.x;
			delete entityModel.y;
			return new Promise((resolve, reject) => {
				fs.writeFile(
					path.join(this.app.path, relativePath),
					JSON.stringify(entityModel, null, '\t'),
					err => {
						if (err) {
							return reject(err);
						} else {
							return resolve();
						}
					}
				);
			});
		}
	}

	savePosition() {
		const oldEntitiesPositionConfig = this.app.config.get(null, ConfigType.ENTITIES_POSITION);
		const newEntitiesPositionConfig = Object.assign({}, oldEntitiesPositionConfig, {
			[this.name]: {
				x: Math.round(this.x * 100) / 100,
				y: Math.round(this.y * 100) / 100
			}
		});
		this.app.config.set(newEntitiesPositionConfig, null, ConfigType.ENTITIES_POSITION);
		return this.app.config.save();
	}

	/**
	Returns a list of the relations
	@returns {Array<Relation>}
	*/
	getRelations(): Array<IRelation> { return this.relations; }

	/**
	 Returns all asociated entities
	 @returns {Array<Relation>}
	 */
	getRelatedEntities(): Entity[] {
		const associatedEntity = {};
		const entities = this.app.entities.entities;
		for (const name in entities) {
			if (entities[name]) {
				const entity = entities[name];
				for (const entityRelation of entity.relations) {
					if (entityRelation.reference.entity === this.name) {
						associatedEntity[name] = entity;
					}
				}
			}
		}
		// To find associatedTable from belongsToMany relation
		for (const relation of this.relations) {
			if (relation.reference && relation.reference.entity) {
				associatedEntity[relation.reference.entity] = entities[relation.reference.entity];
			}
		}

		// Object.values()
		const associatedEntityArray = [];
		for (const k in associatedEntity) {
			if (associatedEntity[k]) {
				associatedEntityArray.push(associatedEntity[k]);
			}
		}
		return associatedEntityArray;
	}

	/**
	Returns a relation determined by a field name
	@param {string} - Entity's field name
	@returns {Relation} - BelongsTo/HasMany/HasOne relationship
	*/
	getRelationByField(field: string): IRelation {
		for (const relation of this.relations) {
			if (relation.type === 'belongsTo') {
				if (field == relation.field) {
					return relation;
				}
			} else if (relation.type === 'hasMany' || relation.type === 'hasOne') {
				if (field === relation.reference.field) {
					return relation;
				}
			}
		}
		return null;
	}
	/**
	Returns a belongsToMany relation determined by a junction table entity name
	@param {string} - BelongsToMany junction table entity's name
	@returns {Relation} - BelongsToMany relationship
	*/
	getBelongsToManyRelation(entityThrough: string) {
		return this.relations.find(r => r.type === 'belongsToMany' && r.through === entityThrough);
	}

	/**
	Determines if a relation exists
	@param {Relation} - Relation to find in the relations array.
	@returns {integer} Index of the relation in the relations array, or -1 if non existant.
	*/
	getRelationIndex(relation: IRelation): number {
		let res = -1;
		this.relations.forEach((rel, i) => {
			if (res != -1) {
				return false;
			}

			if (relation && relation.field && relation.field == rel.field) {
				res = i; // type belongsTo
			} else if (relation && relation.as && relation.as == rel.as
					&& relation.reference.entity == rel.reference.entity
					&& relation.reference.as == rel.reference.as) {
				res = i; // type belongsToMany
			} else if (relation && relation.reference.field
					&& relation.reference.entity == rel.reference.entity
					&& relation.reference.field == rel.reference.field) {
				res = i; // type hasMany
			}
		});
		return res;
	}

	getPK(): Array<Field> {
		return this.fields.filter(field => field.primary);
	}

	/**
	Add a relation to the entity
	@param {Relation} - Relation's description.
	@param {object} - Action's options
	@returns {Promise}
	*/
	addRelation(relation: IRelation, options?: IApplyOptions): Promise<any> {
		options = options || {};
		if (relation.field && relation.reference.entity == relation.field) {
			return Promise.resolve(new MateriaError('The reference field cannot have the same name that its referenced entity'));
		}

		const entityDest = this.app.entities.get(relation.reference.entity);
		let p: Promise<any> = Promise.resolve();
		if ( ! relation.type || relation.type == 'belongsTo') {
			relation.type = 'belongsTo';

			if ( ! entityDest) {
				if (options.apply != false) {
					this.relations.push(relation);
				}
				return Promise.resolve(); // when loading entities
			}

			let keyReference = entityDest.getPK()[0];
			if (relation.reference.field && relation.reference.field != keyReference.name) {
				const f = entityDest.getField(relation.reference.field);
				if ( ! f) {
					return Promise.reject(
						new MateriaError(`The relation's referenced field ${entityDest.name}.${relation.reference.field} does not exist`)
					);
				}
				if ( ! f.unique) {
					return Promise.reject(new MateriaError(`${entityDest.name}.${f.name} cannot be referenced in relation (need to be unique/primary)`));
				}
				keyReference = f;
			}
			if (options.apply != false) {
				this.relations.push(relation);
			}

			let uniqueField = false;
			if (relation.unique !== undefined) {
				uniqueField = relation.unique;
			}

			const newField: IField = {
				name: relation.field,
				type: keyReference.type,
				default: false,
				generateFrom: relation.reference.entity,
				required: true,
				read: true,
				write: true,
				primary: false,
				unique: uniqueField,
				isRelation: relation
			};
			if (relation.reference.entity === this.name) {
				delete newField.generateFrom;
			}

			p = this.addField(newField, options);
		} else if (relation.type == 'hasMany' || relation.type == 'hasOne') {
			if (options.apply != false) {
				this.relations.push(relation);
			}
		} else if (relation.type == 'belongsToMany') {
			if (options.apply != false) {
				this.relations.push(relation);

				if ( ! entityDest) {
					return Promise.resolve(); // when loading entities
				}

				// TODO: Should be all PK of this and relation.reference.entity
				const field1 = this.getPK()[0];
				const field2 = this.app.entities.get(relation.reference.entity).getPK()[0];

				if ( ! relation.as) {
					relation.as = field1.name;
				}

				const isRelation = [{
						field: relation.as,
						entity: this.name
					}, {
						field: relation.reference.as,
						entity: relation.reference.entity
					}
				];

				const implicitRelation = [
					{
						type: 'belongsTo',
						reference: {
							entity: this.name,
							field: field1.name
						}
					},
					{
						type: 'belongsTo',
						reference: {
							entity: relation.reference.entity,
							field: field2.name
						}
					}
				];

				const throughEntity = this.app.entities.get(relation.through);
				if (throughEntity) {

					const asField1 = throughEntity.getField(relation.as);
					const asField2 = throughEntity.getField(relation.reference.as);

					if (throughEntity.isRelation) {
						if (throughEntity.compareIsRelation(relation, this)) {
							return Promise.reject(new MateriaError('Table ' + relation.through + ' is already used for a different relation'));
						}
						p = Promise.resolve();
						if ( ! asField1) {
							p = p.then(() => {
								return throughEntity.addField({
									name: relation.as,
									type: field1.type,
									default: false,
									generateFrom: this.name,
									required: true,
									read: true,
									write: true,
									primary: true,
									unique: true,
									isRelation: implicitRelation[0]
								}, options);
							});
						} else {
							asField1.isRelation = implicitRelation[0];
						}
						if ( ! asField2) {
							p = p.then(() => {
								return throughEntity.addField({
									name: relation.reference.as,
									type: field2.type,
									default: false,
									generateFrom: relation.reference.entity,
									required: true,
									read: true,
									write: true,
									primary: true,
									unique: true,
									isRelation: implicitRelation[1]
								}, options);
							});
						} else {
							asField2.isRelation = implicitRelation[1];
						}
					} else {
						if ( ! asField1 || ! asField2) {
							return Promise.reject(new MateriaError('Cannot use existing table ' + relation.through + ' for a many to many relation'));
						}

						throughEntity.isRelation = isRelation;

						if (asField1.isRelation) {
							asField1.isRelation.implicit = true;
						} else {
							if (asField1.name == relation.as) {
								asField1.references = isRelation[1];
								asField1.isRelation = implicitRelation[0];
							} else {
								asField1.references = isRelation[0];
								asField1.isRelation = implicitRelation[1];
							}
							p = p.then(() => {
								return throughEntity.updateField(asField1.name, asField1, options);
							});
						}

						if (asField2.isRelation) {
							asField2.isRelation.implicit = true;
						} else {
							if (asField2.name == relation.as) {
								asField2.references = isRelation[1];
								asField2.isRelation = implicitRelation[0];
							} else {
								asField2.references = isRelation[0];
								asField2.isRelation = implicitRelation[1];
							}
							p = p.then(() => {
								return throughEntity.updateField(asField2.name, asField2, options);
							});
						}
						p = p.then(() => {
							if (options.save) {
								return throughEntity.save();
							}
						});
					}
				} else {
					p = this.app.entities.add({
						name: relation.through,
						overwritable: true,
						fields: [{
							name: relation.as,
							type: field1.type,
							default: false,
							required: true,
							read: true,
							write: true,
							primary: true,
							unique: true,
							isRelation: implicitRelation[0]
						}, {
							name: relation.reference.as,
							type: field2.type,
							default: false,
							required: true,
							read: true,
							write: true,
							primary: true,
							unique: true,
							isRelation: implicitRelation[1]
						}],
						isRelation: isRelation
					}, options);
				}
			}
		} else {
			return Promise.reject(new Error('Unknown relation type.'));
		}

		if ( ! p) {
			p = Promise.resolve();
		}
		return p.then((result) => {

			if (options.history != false) {
				this.app.history.push({
					type: MigrationType.ADD_RELATION,
					table: this.name,
					value: relation
				}, {
					type: MigrationType.DELETE_RELATION,
					table: this.name,
					value: relation
				});
			}

			if (options.apply != false) {
				this.generateDefaultQueries();
			}

			if (options.save != false) {
				return this.save();
			}
		});
	}

	removeRelation(relation: IRelation, options?: IApplyOptions): Promise<any> {
		options = options || {};

		const i = this.getRelationIndex(relation);
		if (i == -1 && options.apply != false) {
			return Promise.reject(new MateriaError('Could not find relation'));
		}

		let p = Promise.resolve();
		if (options.apply != false) {
			const paired = relation.paired;
			relation = this.relations.splice(i, 1)[0];

			if ( ! paired) {
				let inverseType;
				if (relation.type == 'belongsTo' || ! relation.type) {
					inverseType = 'hasMany';
				} else {
					inverseType = relation.type; // only n-n for now
				}
				const inversedRelation = {
					type: inverseType,
					field: relation.reference.field,
					as: relation.reference.as,
					entity: relation.reference.entity,
					paired: true,
					reference: {
						field: relation.field,
						as: relation.as,
						entity: this.name
					}
				};
				p = this.app.entities.get(relation.reference.entity).removeRelation(inversedRelation, options).catch((e) => {
					if (e.message != 'Could not find relation') {
						throw e;
					}
				});
			}
		}

		if (relation.type == 'belongsToMany') {
			const entityThrough = this.app.entities.get(relation.through);
			if (entityThrough) {
				p = p.then(() => {
					const opts: IApplyOptions = Object.assign({}, options);
					opts.history = false;
					return this.app.entities.remove(relation.through, opts);
				});
			}
		} else if ((relation.type == 'belongsTo' || ! relation.type) && !! this.fields.find(field => field.name == relation.field)) {
			p = p.then(() => {
				return this.removeField(relation.field, options);
			});
		}

		return p.then(() => {
			this.generateDefaultQueries();

			if (options.history != false) {
				this.app.history.push({
					type: MigrationType.DELETE_RELATION,
					table: this.name,
					value: relation
				}, {
					type: MigrationType.ADD_RELATION,
					table: this.name,
					value: relation
				});
			}

			if (options.save != false) {
				return this.save();
			}
		});
	}

	/**
	Get a field description by its name.
	@param {string} - Field's name.
	@returns {Field}
	*/
	getField(name: string): Field {
		return this.fields.find(field => field.name == name);
	}

	/**
	Return true if field exist
	@param {string} - Field's name
	@returns {Boolean}
	*/
	isField(name: string): boolean {
		return !! this.getField(name);
	}

	/**
	Get the entity's fields.
	@returns {Array<Field>}
	*/
	getFields(): Array<Field> { return this.fields; }

	/**
	Get the entity's writable fields.
	@returns {Array<Field>}
	*/
	getWritableFields(): Array<Field> {
		return this.fields.filter(field => field.write);
	}

	/**
	Get the entity's unique fields.
	@param {string|boolean} - unique group name, or true for independent uniques fields, or false for non unique fields.
	@returns {Array<Field>}
	*/
	getUniqueFields(group: string | boolean): Array<Field>  {
		return this.fields.filter(field => field.unique == group);
	}

	/**
	Get the entity's readable fields.
	@returns {Array<Field>}
	*/
	getReadableFields(): Array<Field>  {
		return this.fields.filter(field => field.read);
	}

	/**
	Update a field.
	@param {string} - Field's name to update
	@param {object} - New field description
	@param {object} - Action's options
	@returns {Promise<Field>}
	*/
	updateField(name: string, newfield: IFieldUpdate, options?): Promise<Field> {
		return new Promise((accept, reject) => {
			options = options || {};

			if (! name) {
				return reject();
			}

			let fieldobj;
			try {
				fieldobj = new Field(this, newfield);
			} catch (e) {
				return reject(e);
			}

			const done = () => {
				if (options.apply != false && fieldobj.name != name) {
					for (const relation of this.relations) {
						if (relation.field == name) {
							relation.field = fieldobj.name;
						}
					}
				}
				this.fields.forEach((field, k) => {
					if (field.name == name) {
						if (options.apply != false) {
							this.fields.splice(k, 1, fieldobj);
						}
						if (options.history != false) {
							this.app.history.push({
								type: MigrationType.CHANGE_FIELD,
								table: this.name,
								name: field.name,
								value: fieldobj.toJson()
							}, {
								type: MigrationType.CHANGE_FIELD,
								table: this.name,
								name: fieldobj.name,
								value: field.toJson()
							});
						}
					}
				});

				let p = Promise.resolve();

				if (options.save != false) {
					p = p.then(() => this.save());
				}

				this.generateDefaultQueries();
				return p;
			};

			if (options.differ) {
				options.differ(done);
				accept(fieldobj);
			} else {
				done().then(() => accept(fieldobj));
			}
		});
	}

	/**
	Add a new field.
	@param {object} - New field description
	@param {integer} - Field position in list
	@param {object} - Action's options
	@returns {Promise<Field>}
	*/
	addFieldAt(field: IField, at: number, options?): Promise<Field> {
		options = options || {};

		let fieldobj: Field;
		try {
			fieldobj = new Field(this, Object.assign({}, field, {
				read: true,
				write: field.autoIncrement ? false : true
			}));
		} catch (e) {
			return Promise.reject(e);
		}

		if (options.apply != false) {
			const oldfield = this.getField(field.name);
			if (oldfield) {
				if (field.isRelation) {
					oldfield.isRelation = field.isRelation;
					return Promise.resolve(oldfield);
				}
				if ( options.noErrors ) {
					return Promise.resolve(oldfield);
				} else {
					return Promise.reject(new MateriaError('A field of this name already exists'));
				}
			}
			this.fields.splice(at, 0, fieldobj);
		}

		if (options.history != false && ! field.isRelation) {
			this.app.history.push({
				type: MigrationType.ADD_FIELD,
				table: this.name,
				value: fieldobj.toJson(),
				position: at
			}, {
				type: MigrationType.DELETE_FIELD,
				table: this.name,
				value: field.name
			});
		}

		let p = Promise.resolve();

		if (options.save != false) {
			p = p.then(() => this.save());
		}

		if (options.generateQueries !== false) {
			this.generateDefaultQueries();
		}

		return p.then(() => fieldobj);
	}

	/**
	Add a new field. Shortcut for addFieldAt(field, *fields count*, options)
	@param {object} - New field description
	@param {object} - Action's options
	@returns {Promise<Field>}
	*/
	addField(field: IField, options?): Promise<Field> {
		return this.addFieldAt(field, this.fields.length, options);
	}

	/**
	Add a new field. Shortcut for addFieldAt(field, 0, options)
	@param {object} - New field description
	@param {object} - Action's options
	@returns {Promise<Field>}
	*/
	addFieldFirst(field: IField, options?): Promise<Field> {
		return this.addFieldAt(field, 0, options);
	}

	/**
	Delete a field
	@param {string} - Field's name
	@param {object} - Action's options
	@returns {Promise}
	*/
	removeField(name: string, options?): Promise<void> {
		options = options || {};
		if (! name) {
			return Promise.reject(new MateriaError('The name of the field is required'));
		}
		if (options.apply != false && ! this.getField(name)) {
			return Promise.reject(new MateriaError('This field does not exist'));
		}
		this.fields.forEach((field, k) => {
			if (field.name == name) {
				if (options.apply != false) {
					this.fields.splice(k, 1);
				}
				if (options.history != false) {
					this.app.history.push({
						type: MigrationType.DELETE_FIELD,
						table: this.name,
						value: field.name
					}, {
						type: MigrationType.ADD_FIELD,
						table: this.name,
						value: field.toJson(),
						position: k
					});
				}
			}
		});

		this.generateDefaultQueries();
		if (options.save != false) {
			return this.save();
		}

		return Promise.resolve();
	}

	/**
	Return the entity's description
	@returns {object}
	*/
	toJson(): IEntityConfig {
		const fieldsJson = [];
		if (this.fields) {
			for (const field of this.fields) {
				if ( ! field.isRelation || ! field.isDefaultRelationField()) {
					fieldsJson.push(field.toJson());
				}
			}
		}

		const relJson = [];
		if (this.relations) {
			this.relations.forEach(relation => {
				if ( ! relation.implicit) {
					const relCopy = {} as any;
					for (const k in relation) {
						if (k != 'entity' && k != '$$hashKey') {
							relCopy[k] = relation[k];
						}
					}
					if ( ! relCopy.type) {
						relCopy.type = 'belongsTo';
					}
					relJson.push(relCopy);
				}
			});
		}

		const queriesJson = [];
		if (this.queries) {
			this.queries.forEach(query => {
				queriesJson.push(query.toJson());
			});
		}

		const res: IEntityConfig = {
			id: this.id,
			x: this.x,
			y: this.y,
			fields: [],
			relations: [],
			queries: []
		};

		if (fieldsJson.length) {
			res.fields = fieldsJson;
		}

		if (this.isRelation) {
			res.isRelation = this.isRelation;
		}

		if (relJson.length) {
			res.relations = relJson;
		}

		if (queriesJson.length) {
			res.queries = queriesJson;
		}

		return res;
	}

	addDefaultQuery(id: string, type: string, params, opts) {
		return this.addQuery({
			id: id,
			type: type,
			opts: opts
		}, {history: false, save: false});
	}

	/**
	Add a query to the entity
	@param {string} - Query's name
	@param {object} - Query's data
	@param {object} - Action's options
	*/
	addQuery(query: IQuery, options?: IApplyOptions): Promise<Query> {
		options = options || {};

		if ( ! this.queryObjects[query.type]) {
			return Promise.reject(new MateriaError('Query type `' + query.type + '` not defined'));
		}

		const QueryClass = this.queryObjects[query.type];
		const queryobj: Query = new QueryClass(this, query.id, query.opts);

		if (options.apply != false) {
			// check that query with `id` = id does not exist. if it exists, remove the query
			const index = this.queries.indexOf(this.queries.find(q => q.id == query.id));
			if (index != -1) {
				this.queries.splice(index, 1);
			}

			this.queries.push(queryobj);
		}

		if (options.history != false) {
			this.app.history.push({
				type: MigrationType.ADD_QUERY,
				table: this.name,
				id: query.id,
				value: queryobj.toJson()
			}, {
				type: MigrationType.DELETE_QUERY,
				table: this.name,
				id: query.id
			});
		}

		if (options.save != false) {
			return this.save().then(() => queryobj);
		} else {
			return Promise.resolve(queryobj);
		}
	}

	getNewQuery(id: string, type: string, opts): IQueryConstructor {
		if ( ! this.queryObjects[type]) {
			throw new MateriaError('Query type `' + type + '` not defined');
		}

		const QueryClass = this.queryObjects[type];
		const queryobj = <IQueryConstructor> new QueryClass(this, id, opts);

		return queryobj;
	}

	/**
	Delete a query
	@param {string} - Query's name
	@param {object} - Action's options
	*/
	removeQuery(id: string, options?: IApplyOptions): Promise<void> {
		options = options || {};

		const queryobj = this.getQuery(id);

		if ( ! queryobj) {
			return Promise.reject(new MateriaError('Could not find query `' + id + '`'));
		}

		if (options.apply != false) {
			const index = this.queries.indexOf(this.queries.find(query => query.id == id));
			if (index != -1) {
				this.queries.splice(index, 1);
			}
		}

		if (options.history != false) {
			this.app.history.push({
				type: MigrationType.DELETE_QUERY,
				table: this.name,
				id: id
			}, {
				type: MigrationType.ADD_QUERY,
				table: this.name,
				id: id,
				value: queryobj.toJson()
			});
		}

		if (options.save != false) {
			return this.save();
		} else {
			return Promise.resolve();
		}
	}

	/**
	Get a query object
	@param {string} - Query's name
	@returns {Query}
	*/
	getQuery(id): Query {
		for (const query of this.queries) {
			if (query.id == id) {
				return query;
			}
		}
		return null;
	}

	refreshQueries() {
		for (const query of this.queries) {
			try {
				query.refresh();
				query.discoverParams();
			} catch (e) {
				this.app.logger.error(e);
			}
		}
	}

	/**
	Get the entity's queries
	@returns {Array<Query>}
	*/
	getQueries() { return this.queries; }

	compareIsRelation(relation, entity): boolean {
		if ( ! this.isRelation) {
			return true;
		}
		if (this.isRelation[0].field == relation.as) {
			if (this.isRelation[0].entity == entity.name
				&& this.isRelation[1].field == relation.reference.as
				&& this.isRelation[1].entity == relation.reference.entity) {
					return false;
				}
		} else if (this.isRelation[1].field == relation.as) {
			if (this.isRelation[1].entity == entity.name
				&& this.isRelation[0].field == relation.reference.as
				&& this.isRelation[0].entity == relation.reference.entity) {
					return false;
				}
		}

		return true;
	}

	defineQueryObjects(data) {
		this.queryObjects = data;
	}

	getQueryTypes() {
		return Object.keys(this.queryObjects);
	}

	abstract loadModel(): Promise<any>;

	loadRelationsInModel() { }
}