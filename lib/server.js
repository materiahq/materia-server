'use strict';

var fs = require('fs')
var path = require('path')

var express = require('express')
//var compression = require('compression')
var morgan = require('morgan')
var cookieParser = require('cookie-parser')
var methodOverride = require('method-override')
var bodyParser = require('body-parser')
var errorHandler = require('errorhandler')
var session = require('express-session')

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
		this.expressApp.use(session({
			secret: 'keyboard cat',
			cookie: { maxAge: 60000 },
			resave: false,
			saveUninitialized: false
		}))
		//if (fs.existsSync(path.join(this.app.path, 'static'))) {
		this.expressApp.use(express.static(path.join(this.app.path, 'web')));
		//}
		if ((app.mode == 'dev' || app.options.logRequests) && app.options.logRequests != false) {
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
			let content = fs.readFileSync(path.join(this.app.path, 'server.json')).toString()
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

    getBaseUrl() {
        let conf = this.getConfig()
        let url = 'http://' + conf.host;
        if (conf.port != 80) {
            url += ':' + conf.port
        }
        url += '/api'
        return url
    }

	isStarted() { return this.started }

	getConfig(mode) {
		if ( ! this.config) {
			throw new Error('The server is not configured yet.')
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

    setConfig(config, mode) {
        if ( ! config.host || ! config.port ) {
            //missing needed parameters
            return false
        }
        if ( ! mode ) {
            mode = this.app.mode
        }
        if (this.config[mode]) {
            this.config[mode] = config
        }
        else {
            this.config = config
        }
        return this.config
    }

	save() {
		fs.writeFileSync(path.join(this.app.path, 'server.json'), JSON.stringify(this.toJson(), null, '\t'))
	}

	hasStatic() {
		return fs.existsSync(path.join(this.app.path, 'web', 'index.html'))
	}

	toJson() { return this.config }

	start(host, port) {
		let promise = new Promise((resolve, reject) => {

			this.stop()
			this.app.api.registerEndpoints(this.expressApp)
			this.expressApp.all('/api/*', (req, res) => {
				res.status(404).send({
					error: true,
					code: 404,
					message: 'API endpoint not found'
				})
			})

			this.expressApp.all('/*', (req, res) => {
				if (fs.existsSync(path.join(this.app.path, 'web', '404.html'))) {
					res.sendFile(path.join(this.app.path, 'web', '404.html'))
				}
				else if (this.hasStatic()) {
					res.sendFile(path.join(this.app.path, 'web', 'index.html'))
				}
				else {
					res.status(404).send({
						error: true,
						code: 404,
						message: 'API endpoint not found'
					})
				}
			})
			let config = this.getConfig()
			//console.log('server config', config, this.app.mode)
			let errListener = (err) => { reject(err) }
			let args = [this.app.options["port"] || config.port, config.host, () => {
				this.started = true
				this.app.log('Server listening on %s:%d', config.host, config.port)
				this.server.removeListener('error', errListener)
				resolve()
			}]
			if (config.host == '0.0.0.0') {
				args[1] = args.pop()
			}
			this.server.listen.apply(this.server, args).on('error', errListener);
		});
		return promise
	}

	stop() {
		if (this.server && this.started) {
			this.server.close()
			this.app.log('Stopped server')
			this.started = false
		}
	}
}

module.exports = Server
