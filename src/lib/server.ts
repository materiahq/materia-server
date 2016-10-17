'use strict';

import * as fs from 'fs'
import * as path from 'path'

import App, { AppMode } from './app'

import * as express from 'express'

//var compression = require('compression')
import * as morgan from 'morgan'
import * as cookieParser from 'cookie-parser'
import * as methodOverride from 'method-override'
import * as bodyParser from 'body-parser'
import * as errorHandler from 'errorhandler'
import * as session from 'express-session'

var enableDestroy = require('server-destroy')

export interface IBasicServerConfig {
	port: number,
	host: string
}

export interface IFullServerConfig {
	dev?: {
		port: number,
		host: string
	},
	prod?: {
		port: number,
		host: string
	}
}

/**
 * @class Server
 * @classdesc
 * Represent the server
 */
export class Server {
	started: boolean = false
	config: IBasicServerConfig | IFullServerConfig

	expressApp: express.Application
	server: any

	constructor(private app: App) {
	}

	load() {
		try {
			let content = fs.readFileSync(path.join(this.app.path, 'server.json')).toString()
			this.config = JSON.parse(content)
		}
		catch (e) {
			this.config = {
				host: 'localhost',
				port: 8080
			}
		}

		this.expressApp = express()

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
		this.expressApp.use(express.static(path.join(this.app.path, 'web')));
		if ((this.app.mode == AppMode.DEVELOPMENT || this.app.options.logRequests) && this.app.options.logRequests != false) {
			this.expressApp.use(morgan('dev'))
		}

		//TODO: Option to enable / disable CORS API call
		this.expressApp.use(function(req, res, next) {
			res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
			next();
		});
		this.expressApp.use(errorHandler())

		this.server = require('http').createServer(this.expressApp)
		enableDestroy(this.server)
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
	isStarted():boolean { return this.started }

	/**
	Get the database configuration
	@param {string} - The environment mode. `development` or `production`.
	@returns {object}
	*/
	getConfig(mode?:AppMode):IBasicServerConfig {
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
	setConfig(config: IBasicServerConfig, mode: AppMode):IBasicServerConfig | IFullServerConfig | boolean {
		//Question: Is this still needed with typescript ?
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
			opts.beforeSave('server.json')
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
		return this.stop().then(() => {
			this.app.api.registerEndpoints()
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

			this.expressApp.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
				res.status(500).send({
					error: true,
					message: (err && err.message) || "Unexpected error"
				})
				return this.expressApp
			})


			let config = this.getConfig()
			return new Promise((resolve, reject) => {
				let errListener = (err) => {
					if (err.code == 'EADDRINUSE') {
						this.app.logger.log('\nError while starting the server: The port is already used by another server.')
					}
					else {
						this.app.logger.log('\nError while starting the server:' , err);
					}
					return reject(err)
				}

				let port = this.app.options.port || config.port
				let args = [port, config.host, () => {
					this.started = true
					this.app.logger.log(`Server listening on ${config.host}:${port}`)
					this.server.removeListener('error', errListener)
					return resolve()
				}]
				if (config.host == '0.0.0.0') {
					args[1] = args.pop()
				}
				this.server.listen.apply(this.server, args).on('error', errListener);
			})
		})
	}

	/**
	Stops the server.
	*/
	stop(options?):Promise<any> {
		if ( ! this.server || ! this.started) {
			return Promise.resolve()
		}

		return new Promise((accept, reject) => {
			let method = (options && options.force) ? 'destroy' : 'close'
			this.server[method](() => {
				this.app.logger.log('Server closed')
				this.started = false
				accept()
			})
		})
	}
}