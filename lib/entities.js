'use strict';

var fs = require('fs')
var path = require('path')

var mkdirp = require('mkdirp')

var DBEntity = require('./entities/db-entity')
var Entity = require('./entities/entity')

/**
 * @class Entities
 * @classdesc
 * Entity manager. This class is relative to all the entities of an app.
 */
class Entities {
	constructor(app) {
		this.app = app
		this.DiffType = app.history.DiffType
		this.entities = {}
		this.relations = []

		this.app.history.register(this.DiffType.CREATE_ENTITY, (data, opts) => {
			return this.add(data.value, opts)
		})

		this.app.history.register(this.DiffType.RENAME_ENTITY, (data, opts) => {
			return this.rename(data.table, data.value, opts)
		})

		this.app.history.register(this.DiffType.DELETE_ENTITY, (data, opts) => {
			return this.remove(data.table, opts)
		})

		this.app.history.register(this.DiffType.ADD_FIELD, (data, opts) => {
			return this.get(data.table).addFieldAt(data.value, data.position, opts)
		})

		this.app.history.register(this.DiffType.CHANGE_FIELD, (data, opts) => {
			return this.get(data.table).updateField(data.name, data.value, opts)
		})

		this.app.history.register(this.DiffType.DELETE_FIELD, (data, opts) => {
			return this.get(data.table).removeField(data.value, opts)
		})


		this.app.history.register(this.DiffType.ADD_RELATION, (data, opts) => {
			return this.get(data.table).addRelation(data.value, opts)
		})

		this.app.history.register(this.DiffType.DELETE_RELATION, (data, opts) => {
			return this.get(data.table).removeRelation(data.value, opts)
		})


		this.app.history.register(this.DiffType.ADD_QUERY, (data, opts) => {
			return this.get(data.table).addQuery(data.id, data.values.type, data.values.params, data.values.opts, opts)
		})

		this.app.history.register(this.DiffType.DELETE_QUERY, (data, opts) => {
			return this.get(data.table).removeQuery(data.id, opts)
		})

		this.app.history.register(this.DiffType.ADD_QUERY_PARAM, (data, opts) => {
			return this.get(data.table).getQuery(data.id).addParam(data.value, opts)
		})

		this.app.history.register(this.DiffType.DELETE_QUERY_PARAM, (data, opts) => {
			return this.get(data.table).getQuery(data.id).delParam(data.value, opts)
		})

		this.app.history.register(this.DiffType.UPDATE_QUERY_VALUE, (data, opts) => {
			return this.get(data.table).getQuery(data.id).updateValue(data.value.name, data.value.value, opts)
		})
	}

	_loadFromPath(basePath, opts) {
		return new Promise((resolve, reject) => {
			let files;
			try {
				files = fs.readdirSync(path.join(basePath, 'entities'))
			} catch (e) {
				files = []
				fs.mkdirSync(path.join(basePath, 'entities'))
				return accept(false)
			}

			let promises = []

			files.forEach((file) => {
				try {
					if (file.substr(file.length - 5, 5) == '.json') {
						let content = fs.readFileSync(path.join(basePath, 'entities', file))
						let entity = JSON.parse(content.toString())
						entity.name = file.substr(0, file.length - 5)
						promises.push(this.add(entity, opts));
					}
				} catch (e) {
					e += ' in ' + file
					throw new Error(e)
				}
			})

			Promise.all(promises).then(() => {
				resolve()
			}).catch((e) => {
				reject(e)
			})
		})
	}

	load() {
		return new Promise((accept, reject) => {
			this.entities = {}
			this._loadFromPath(this.app.path, {
				history: false,
				db: false,
				save: false,
				wait_relations: true
			}).then(() => {
				accept()
			}).catch((err) => {
				reject(err)
			})
		})
	}

	loadFromAddon(addon) {
		return new Promise((accept, reject) => {
			this._loadFromPath(path.join(this.app.path, 'addons', addon), {
				history: false,
				db: true,
				save: false,
				wait_relations: true,
				fromAddon: addon
			}).then(() => {
				accept()
			}).catch((err) => {
				reject(err)
			})
		})
	}

	start() {
		return new Promise((resolve, reject) => {
			if ( this.app.database.disabled ) {
				return Promise.resolve()
			}

			//Apply relations before sync
			let promises = []
			for (let name in this.entities) {
				let entity = this.entities[name]
				promises.push(entity.applyRelations())
			}


			//detect rename then sync database
			Promise.all(promises).then(() => {
				return this.detect_rename()
			}).then(() => {
				return this._save_id_map()
			}).then(() => {
				return this.app.database.sync()
			}).then(() => {
				resolve()
			}).catch((e) => {
				reject(e)
			})
		})
	}

	/**
	Add a new entity
	@param {object} - Entity description
	@param {object} - Action's options
	@returns {Promise<Entity>}
	*/
	add(entityobj, options) {
		options = options || {}

		let entity, createPromise
		if (entityobj instanceof Entity) {
			entity = entityobj
			createPromise = Promise.resolve()
		} else {
			if (! entityobj.name)
				return Promise.reject(new Error('missing entity name'))
			entity = new DBEntity(this.app)
			if ( ! entityobj.isRelation && (! entityobj.fields || ! entityobj.fields.length)) {
				entityobj.fields = [
					{
						"name": "id",
						"type": "number",
						"required": true,
						"primary": true,
						"unique": true,
						"default": false,
						"autoIncrement": true,
						"read": true,
						"write": false
					}
				]
			}
			if (entityobj.overwritable && this.entities[entity.name] && this.apply)
				return Promise.resolve(entity)
			if (entityobj.isRelation && entityobj.relations)
				delete entityobj.relations
			createPromise = entity.create(entityobj, {wait_relations:options.wait_relations, fromAddon: options.fromAddon})
		}

		return new Promise((accept, reject) => {
			createPromise.then(() => {

				//maybe we'll have to move this after `if (options.apply != false)` block
				if (options.save != false) {
					entity.save(options)
				}

				if (options.apply != false) {
					this.entities[entity.name] = entity
					this.app.emit('entity:added', entity)
				}

				if (options.overwritable)
					return accept(entity)

				if (options.history != false) {
					this.app.history.push({
						type: this.DiffType.CREATE_ENTITY,
						table: entity.name,
						value: entity.toJson()
					},{
						type: this.DiffType.DELETE_ENTITY,
						table: entity.name
					})
				}

				if (options.db == false)
					return accept(entity)

				let p
				if (options.apply != false) {
					entity.initDefaultQuery()
					p = this.sync().then(() => {
						entity.refreshQueries()
					})
				}
				else {
					p = entity.loadModel()
				}

				p = p.then(() => {
					return entity.model.sync()
				}).then(function() {
					accept(entity)
				}, function(err) {
					reject(err)
				})
			}, function(err) {
				reject(err)
			})
		})
	}

	_save_id_map() {
		return new Promise((resolve, reject) => {
			let name_map = {}
			for (let entity_name in this.entities) {
				let entity = this.entities[entity_name]
				name_map[entity.id] = entity_name
			}

			mkdirp(path.join(this.app.path, '.materia'), (err) => {
				if (err) {
					console.error(err)
					return reject(err)
				}
				try {
					fs.writeFileSync(path.join(this.app.path, '.materia', 'ids.json'), JSON.stringify(name_map))
					return resolve()
				} catch (e) {
					console.error(e)
					return reject(e);
				}
			})
		})
	}

	detect_rename() {
		let name_map
		try {
			let content = fs.readFileSync(path.join(this.app.path, '.materia', 'ids.json')).toString()
			name_map = JSON.parse(content)
		} catch (e) {
			if (e.code == 'ENOENT')
				return Promise.resolve()
			console.error(e)
			return Promise.reject(e)
		}

		let diffs = []
		for (let entity_name in this.entities) {
			let entity = this.entities[entity_name]
			if (name_map[entity.id] && name_map[entity.id] != entity_name) {
				diffs.push({
					redo: {
						type: this.DiffType.RENAME_ENTITY,
						table: name_map[entity.id],
						value: entity_name
					},
					undo: {
						type: this.DiffType.RENAME_ENTITY,
						table: entity_name,
						value: name_map[entity.id]
					}
				})
			}
		}

		if (diffs.length == 0) {
			return Promise.resolve()
		}

		return this.app.history.apply(diffs, {
			//save: false,
			full_rename: false
		})
	}

	/**
	Delete an entity.
	@param {string} - Entity's name
	@param {object} - Action's options
	@returns {Promise}
	*/
	remove(name, options) {
		options = options || {}
		if ( ! name) {
			return false
		}

		let p = Promise.resolve()
		for (let entity_name in this.entities) {
			for (let relation of this.entities[entity_name].relations) {
				if (relation.reference.entity == name) {
					p = p.then(() => {
						//console.log('delete relation => ', relation)
						return this.entities[entity_name].removeRelation(relation, options)
					})
				}
			}
		}

		return p.then(() => {
			let entity = this.entities[name]

			if (options.history != false) {
				this.app.history.push({
					type: this.DiffType.DELETE_ENTITY,
					table: name
				},{
					type: this.DiffType.CREATE_ENTITY,
					table: name,
					value: entity.toJson()
				})
			}

			if (options.apply != false) {
				delete this.entities[name]
			}

			if (options.save != false && entity && fs.existsSync(path.join(this.app.path, 'entities', name + '.json'))) {
				if (options && options.beforeSave) {
					options.beforeSave()
				}
				fs.unlinkSync(path.join(this.app.path, 'entities', name + '.json'))
				if (options && options.afterSave) {
					options.afterSave()
				}
			}

			if (options.db == false) {
				return
			}

			// TODO: remove constraint to avoid force:true ? more tests needed
			return this.app.database.sequelize.getQueryInterface().dropTable(name, {force:true})
		})
	}

	/**
	Rename an entity
	@param {string} - Entity's name (old name)
	@param {string} - Entity's new name
	@param {object} - Action's options
	@returns {Promise}
	*/
	rename(name, new_name, options) {
		options = options || {}
		let entity = this.get(name)

		if ( ! entity && options.full_rename != false)
			return Promise.reject(new Error('Entity ' + name + ' does not exist.'))

		if ( entity && this.get(new_name))
			return Promise.reject(new Error('Entity ' + new_name + ' already exists.'))

		if (options.history != false) {
			this.app.history.push({
				type: this.DiffType.RENAME_ENTITY,
				table: name,
				value: new_name
			},{
				type: this.DiffType.RENAME_ENTITY,
				table: new_name,
				value: name
			})
		}

		if (options.apply != false) {
			for (let entity_name in this.entities) {
				let entity = this.entities[entity_name]
				let need_save = false
				for (let relation of entity.relations) {
					if (relation.reference && relation.reference.entity == name) {
						need_save = true
						relation.reference.entity = new_name
					}
				}
				if (need_save && options.save != false)
					entity.save(options)
			}

			/*if (entity.fields[0].name == 'id_' + name) {
				entity.fields[0].name = 'id_' + new_name
				// TODO: rename field (with options db:options.db save:false history:false)
			}*/

			if (entity) {
				entity.name = new_name
				this.entities[new_name] = entity
				delete this.entities[name]
			}
		}

		if (options.save != false) {
			if (fs.existsSync(path.join(this.app.path, 'entities', name + '.json'))) {
				if (options && options.beforeSave) {
					options.beforeSave()
				}
				fs.unlinkSync(path.join(this.app.path, 'entities', name + '.json'))
				this._save_id_map().then(() => {
					if (options && options.afterSave) {
						options.beforeSave()
					}
				})
			}
			this.save(options)
		}


		if (options.db == false)
			return Promise.resolve()

		return this.app.database.sequelize.getQueryInterface().renameTable(name, new_name).then(() => {
			return entity.loadModel().then(() => {
				entity.loadRelationsInModel()
			})
		})
	}

	/**
	Returns a list of the entities
	@returns {Array<Entity>}
	*/
	findAll() {
		let ents = []
		for (let ent in this.entities)
			ents.push(this.entities[ent])
		return ents
	}

	/**
	Returns an entity be specifying its name
	@param {string} - Entity's name
	@returns {Entity}
	*/
	get(name) { return this.entities[name] }

	/**
	Returns an entity be specifying its name, or create it with its description
	@param {string} - Entity's name
	@param {string} - Entity's description
	@param {string} - Action's options
	@returns {Entity}
	*/
	getOrAdd(name, entityobj, options) {
		return new Promise((accept, reject) => {
			if (this.entities[name])
				return accept(this.entities[name])
			entityobj.name = name
			this.add(entityobj, options).then((entity) => {
				accept(entity)
			}, (err) => {
				reject(err)
			})
		})
	}

	save(opts) {
		for (let ent in this.entities) {
			this.entities[ent].save(opts)
		}
	}

	/*getCurrentDiff() {
		let diffs = []
		this.entities.forEach((entity) => {
			//entity.
		})
	}

	hasDiff() {
		for (let entity of this.entities) {

		}
	}*/

	sync() {
		let promises = []
		for (let ent in this.entities) {
			promises.push(this.entities[ent].loadModel().catch((err) => {
				err.message = 'Could not load entity ' + ent + ': ' + err.message
				throw err
			}))
		}

		return Promise.all(promises).then(() => {
			//Need a second loop to executes relations when all models are created
			for (let ent in this.entities) {
				this.entities[ent].loadRelationsInModel()
			}
		})
	}

	toJson() {
		let res = {entities: [], relations: []}
		for (let ent in this.entities) {
			res.entities.push(this.entities[ent].toJson())
		}

		for (let rel in this.relations) {
			res.relations.push(this.relations[rel].toJson())
		}

		return res
	}

	findAllRelations(opts) {
		opts = opts || {}
		let res = []
		for (let ent in this.entities) {
			let entity = this.entities[ent]
			for (let r of entity.relations) {
				if ( ! r.implicit || opts.implicit) {
					r.entity = ent
					res.push(r)
				}
			}
			if (entity.isRelation && opts.implicit) {
				for (let f of entity.getFields()) {
					let r = f.isRelation
					if (r) {
						r.entity = ent
						r.implicit = true
						r.field = f.name
						res.push(r)
					}
				}
			}
		}
		return res
	}
}

module.exports = Entities
