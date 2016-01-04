'use strict';

var Server = require('./server')
var Entities = require('./entities')
//var Relations = require('./relations')
var Database = require('./database')
var Addons = require('./addons')
//ApiGenerator = require('./api-generator')
var Api = require('./api')
//var Views = require('./views')

var History = require('./history')

var fs = require('fs')
var path = require('path')

var logger = require('./logger')

module.exports = class App {
	constructor(name, path, mode) {
		process.env.TZ = 'UTC'

		//TODO: set random id
		this.id = Math.round(Math.random() * 1000)
		this.name = name
		this.path = path
		this.materia_path = __dirname
		logger(this)

		this.mode = mode || 'dev'
		if (this.mode == 'development' || this.mode == 'developement') {
			this.mode = 'dev'
		}

		if (this.mode == 'production') {
			this.mode = 'prod'
		}

		if (this.mode != 'dev' && this.mode != 'prod') {
			throw "App constructor - Unknown mode"
		}

		//this.logger = new Logger(this)

		this.history = new History(this)
		this.addons = new Addons(this)

		this.entities = new Entities(this)
		this.database = new Database(this)
		//this.relations = new Relations(this)
		//this.rules = []
		//this.queries = []
		//this.layout = {}

		//this.views = new Views(this)
		this.api = new Api(this)
		this.server = new Server(this)
		//this.load()
	}

	getId() { return this.id }

	// setDatabase(database) {
	// 	this.database = database
	// }
	//
	// setEntities(entities) {
	// 	this.entities = entities
	// }
	//
	// setRelations(relations) {
	//
	// }

	/*initializeDefaultClient() {
		console.log('Generating default client application')
		this.views.add('home', '', 'simple', [
			{
				name: "content.text",
				opts: {
					content: 'Hello World'
				}
			}
		])

		this.layout = {
			type: 'default',
			header: {
				brand: this.name
			}
		}
	}*/

	load() {
		return new Promise((accept, reject) => {
			this.entities.load().then(() => {
				this.database.load()
				this.server.load()
				this.api.load()

				//try {
					//let content = fs.readFileSync(path.join(this.path, 'app.json'))
					//let data = JSON.parse(content)
					//console.log('\nLoading client application: success')
					//this.layout = data.layout
					//this.config = data.config
					//this.views.load(data.states)

					//@views.add state, params.url, params.template, params.components for state,params of data.states
					//console.log @states
				//}
				//catch (e) {
					//console.log('\nLoading client application: fail')
					//this.initializeDefaultClient()
					//this.save()
				//}
				//this.history.clear()

				return this.database.start()
			}).then(() => {
				return this.addons.load()
			}).then(() => {
				accept()
			}).catch((err) => {
				reject(err)
			})
		})
	}

	save() {
		let res = {
			config: this.config,
			layout: this.layout,
			states: this.views.toJson()
		}

		fs.writeFileSync(path.join(this.path, 'app.json'), JSON.stringify(res, null, 2))
	}

	start() {
		this.entities.sync()
		return this.server.start()
	}

	stop() {
		return this.server.stop()
	}

	/*
	getFiles() {
		results = []
		files = fs.readdirSync(this.path)
		files.forEach((file) => {
			if (file != '.DS_Store') {
				if (file == 'entities') {
					results.push({
						label: 'entities',
						children: [
							'empty'
						]
					})
				}
				else {
					results.push({
						label: file
					})
				}
			}
		})

		try {
			let files = fs.readdirSync(path.join(this.path, 'entities'))
			results.forEach(r => {
				if (r.label == 'entities') {
					if (files.length > 0) {
						r.children = []
					}
					files.forEach(f => r.children.push(f))
				}
			})
		} catch (e) {}
		return { label: this.name, children: results }
	}
	*/



	/* Event management for modules communication. */
	on(eventName, callback) {
		if ( ! this.listeners ) {
			this.listeners = {}
		}
		if ( ! this.listeners[eventName]) {
			this.listeners[eventName] = []
		}
		this.listeners[eventName].push(callback)
	}

	emit(eventName, data) {
		if (this.listeners && this.listeners[eventName]) {
			this.listeners[eventName].forEach((listener) => {
				listener(data)
			})
		}
	}
}
