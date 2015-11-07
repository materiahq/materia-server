'use strict';

var fs = require('fs')
var path = require('path')
var DBEntity = require('./db-entity')
var Entity = require('./abstract/entity')

/*
** Entity Manager
*/

class Entities {
	constructor(app) {
		this.app = app
		this.entities = []
		this.relations = []
	}

	load() {
		this.entities = []
		let files;
		try {
			files = fs.readdirSync(path.join(this.app.path, 'entities'))
		} catch (e) {
			files = []
			fs.mkdirSync(path.join(this.app.path, 'entities'))
			return false
		}

		files.forEach((file) => {
			try {
				if (file.substr(file.length - 5, 5) == '.json') {
					let content = fs.readFileSync(path.join(this.app.path, 'entities', file))
					let entity = JSON.parse(content)
					this.add(entity);
				}
			} catch (e) {
				e += ' in ' + file
				throw e
			}
		})
	}

	//Add an Entity
	add(entity) {
		if ( ! (entity instanceof Entity))
			entity = new DBEntity(this.app, entity.name, entity.fields, entity.relations, entity.queries)
		this.entities.push(entity)
		this.app.emit('entity:added', entity)
		return entity
	}

	remove(name) {
		if ( ! name) {
			return false
		}
		let find = false
		this.entities.forEach((entity, k) => {
			if (entity.name == name && ! find) {
				find = true
				this.entities.splice(k, 1)
			}
		})

		if (find && fs.existsSync(path.join(this.app.path, 'entities', name + '.json'))) {
			fs.unlinkSync(path.join(this.app.path, 'entities', name + '.json'))
		}

		//this.app.api.load()
	}

	findAll() { return this.entities }

	get(name) {
		let res = null
		//console.log(this.toJson())
		this.entities.forEach((entity) => {
			if (entity.name == name) {
				res = entity
			}
		})
		return res
	}

	save() {
		this.entities.forEach((entity) => {
			entity.save()
		})
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
		this.entities.forEach((entity) => {
			entity.loadModel()
		})

		//Need a second loop to executes relations when all models are created
		this.entities.forEach((entity) => {
			entity.loadRelationsInModel()
		})
	}

	toJson() {
		let res = {entities: [], relations: []}
		this.entities.forEach((entity) => {
			res.entities.push(entity.toJson())
		})

		this.relations.forEach((relation) => {
			res.relations.push(relation.toJson())
		})

		return res
	}

	/* RELATION */
	addRelation(relation) {
		this.relations.push(relation)
		this.app.emit('relation:added', this.relations)
		return relation
	}

	removeRelation(id) {
		this.relations.splice(id, 1)
		this.app.emit('relation:removed', this.relations)
	}

	findAllRelations() {
		return this.relations
	}
}

module.exports = Entities
