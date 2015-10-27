'use strict';

var express = require('express')
//var compression = require('compression')
var morgan = require('morgan')
var cookieParser = require('cookie-parser')
var methodOverride = require('method-override')
var bodyParser = require('body-parser')
var errorHandler = require('errorhandler')
var fs = require('fs')
var path = require('path')
class Server {
	constructor(app) {
		this.app = app
		this.started = false
		this.expressApp = express()
		//this.expressApp.set('views', this.env.config.root + '/server/views')
		//this.expressApp.engine('html', require('ejs').renderFile)
		//this.expressApp.set('view engine', 'html')
		//this.expressApp.use(compression())
		this.expressApp.use(bodyParser.urlencoded({ extended: false }))
		this.expressApp.use(bodyParser.json())
		this.expressApp.use(methodOverride())
		this.expressApp.use(cookieParser())
		if (app.mode == 'dev' ) {
			this.expressApp.use(morgan('dev'))
		}
		//this.expressApp.use(express.static(path.join(this.env.config.root, 'build')))
		//this.expressApp.set('appPath', this.env.config.root + '/build')
		this.expressApp.use(errorHandler())
		//this.expressApp.use(favicon(path.join(@env.config.root, 'build/images', 'favicon.png')))

		this.server = require('http').createServer(this.expressApp)
	}

	load() {
		try {
			let content = fs.readFileSync(path.join(this.app.path, 'server.json'))
			let json = JSON.parse(content)
			this.config = json
		}
		catch (e) {
			this.config = {
				host: 'localhost',
				port: 8080
			}
		}
	}

	isStarted() { return this.started }

	getConfig(mode) {
		if ( ! this.config) {
			throw 'The server is not configured yet.'
		}

		if ( ! mode) {
			mode = this.app.mode
		}

		let result;
		if (this.config[mode]) {
			result = this.config[mode]
		}
		else {
			result = this.config
		}
		return result
	}

	save() {
		writeFileSync(path.join(this.app.path, 'server.json'), JSON.stringify(this.toJson()))
	}

	toJson() { return this.config }

	start(host, port) {
		let promise = new Promise((resolve, reject) => {

			this.stop()
			this.app.api.registerEndpoints(this.expressApp)

			let config = this.getConfig()
			//console.log('server config', config, this.app.mode)
			this.server.listen(config.port, config.host, () => {
				this.started = true
				console.log('Server listening on %d', config.port)
				resolve()
			}).on('error', (err) => { reject(err) });
		});
		return promise
	}

	stop() {
		if (this.server && this.started) {
			this.server.close()
			this.started = false
		}
	}
}

module.exports = Server
