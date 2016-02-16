'use strict';

var events = require('events')

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

module.exports = class App extends events.EventEmitter {
	constructor(name, path, options) {
		super()
		process.env.TZ = 'UTC'

		//TODO: set random id
		this.id = Math.round(Math.random() * 1000)
		this.name = name
		this.path = path
		this.options = options || {}
		this.materia_path = __dirname

		this.mode = this.options.mode || 'dev'
		if (this.mode == 'development' || this.mode == 'developement') {
			this.mode = 'dev'
		}
		else if (this.mode == 'production') {
			this.mode = 'prod'
		}
		else if (this.mode != 'dev' && this.mode != 'prod') {
			throw new Error("App constructor - Unknown mode")
		}

		logger(this)

		this.history = new History(this)
		this.addons = new Addons(this)

		this.entities = new Entities(this)
		this.database = new Database(this)
		//this.layout = {}

		//this.views = new Views(this)
		this.api = new Api(this)
		this.server = new Server(this)
	}

	getId() { return this.id }

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
				this.history.load()

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

	getFiles(name, p) {
        name = name || this.name
        p = p || this.path
		let results = []
		let files = fs.readdirSync(p)
		files.forEach((file) => {
			if (file != '.DS_Store') {
                let stats = fs.lstatSync(path.join(p, file))
                if (stats.isDirectory()) {
					results.push(this.getFiles(file, path.join(p, file)))
				}
				else {
					results.push({
						filename: file,
                        path: p,
                        fullpath: path.join(p, file)
					})
				}
			}
		})

		return {
            filename: name,
            path: p,
            fullpath: p,
            children: results
        }
	}
    readFile(fullpath) {
        return fs.readFileSync(fullpath, 'utf8')
    }

    saveFile(fullpath, content) {
        return fs.writeFileSync(fullpath, content);
    }
}
