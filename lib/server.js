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

/**
 * @class Server
 * @classdesc
 * Represent the server
 */
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

		//TODO: Option to enable / disable CORS API call
		this.expressApp.use(function(req, res, next) {
			res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
			next();
		});
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

	/**
	Get the base url for endpoints
	@returns {string}
	*/
	getBaseUrl() {
		let conf = this.getConfig()
		let url = 'http://' + conf.host;
		if (conf.port != 80) {
			url += ':' + conf.port
		}
		url += '/api'
		return url
	}

	/**
	Return true if the server is started
	@returns {boolean}
	*/
	isStarted() { return this.started }

	/**
	Get the database configuration
	@param {string} - The environment mode. `development` or `production`.
	@returns {object}
	*/
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

	/**
	Set the database configuration
	@param {object} - The configuration object
	@param {string} - The environment mode. `development` or `production`.
	*/
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

	save(opts) {
		if (opts && opts.beforeSave) {
			opts.beforeSave()
		}
		fs.writeFileSync(path.join(this.app.path, 'server.json'), JSON.stringify(this.toJson(), null, '\t'))
		if (opts && opts.afterSave) {
			opts.afterSave()
		}
	}

	/**
	Return true if the server has a static page
	@returns {boolean}
	*/
	hasStatic() {
		return fs.existsSync(path.join(this.app.path, 'web', 'index.html'))
	}

	/**
	Return the server's configuration
	@returns {object}
	*/
	toJson() { return this.config }

	/**
	Starts the server and listen on its endpoints.
	@returns {Promise}
	*/
	start() {
		let promise = new Promise((resolve, reject) => {
			this.stop()
			this.app.api.registerEndpoints(this.expressApp)
			this.expressApp.all('/api/*', (req, res) => {
				res.status(404).send({
					error: true,
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
						message: 'API endpoint not found'
					})
				}
			})

			this.expressApp.use((err, req, res, next) => {
				res.status(500).send({
					error: true,
					message: (err && err.message) || "Unexpected error"
				})
			})


			let config = this.getConfig()
			//console.log('server config', config, this.app.mode)
			let errListener = (err) => {
				if (err.code == 'EADDRINUSE') {
					this.app.log('\nError while starting the server: The port is already used by another server.')
				}
				else {
					this.app.log('\nError while starting the server:' , err);
				}
				return reject(err)
			}
			let args = [this.app.options["port"] || config.port, config.host, () => {
				this.started = true
				this.app.log('Server listening on %s:%d', config.host, config.port)
				this.server.removeListener('error', errListener)
				return resolve()
			}]
			if (config.host == '0.0.0.0') {
				args[1] = args.pop()
			}
			this.server.listen.apply(this.server, args).on('error', errListener);
		});
		return promise
	}

	/**
	Stops the server.
	*/
	stop() {
		if (this.server && this.started) {
			this.server.close()
			this.app.log('Stopped server')
			this.started = false
		}
	}
}

module.exports = Server
