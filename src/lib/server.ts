'use strict';

import * as fs from 'fs'
import * as path from 'path'

import App, { AppMode, ISaveOptions } from './app'
import { IDatabaseServerConfig } from './database'

import * as express from 'express'

//var compression = require('compression')
import * as morgan from 'morgan'
import * as cookieParser from 'cookie-parser'
import * as methodOverride from 'method-override'
import * as bodyParser from 'body-parser'
import * as errorHandler from 'errorhandler'
import * as session from 'express-session'
import * as compression from 'compression'

var enableDestroy = require('server-destroy')

export interface IWebServerConfig {
	port: number,
	host: string,
	live?: IWebServerConfig
}

export interface IFullServerConfig {
	dev?: {
		web: IWebServerConfig
		database?: IDatabaseServerConfig
	}
	prod?: {
		web: IWebServerConfig
		database?: IDatabaseServerConfig
	}
}

export enum ConfigType {
	WEB = <any>"web",
	DATABASE = <any>"database"
}

export interface IConfigOptions {
	live?: boolean
}

/**
 * @class Server
 * @classdesc
 * Represent the server
 */
export class Server {
	started: boolean = false
	config: IFullServerConfig

	expressApp: express.Application
	server: any

	disabled: boolean = false

	constructor(private app: App) {
	}

	load() {
		this.expressApp = express()

		this.expressApp.use(bodyParser.urlencoded({ extended: false }))
		this.expressApp.use(bodyParser.json())
		this.expressApp.use(methodOverride())
		this.expressApp.use(cookieParser())
		this.expressApp.use(compression())
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
	getBaseUrl(path?:string, mode?:AppMode, options?:IConfigOptions) {
		path = path || '/api'
		let conf = this.getConfig(mode, ConfigType.WEB, options)
		if ( ! conf) {
			return ""
		}
		let url = 'http://' + conf.host;
		if (conf.port != 80) {
			url += ':' + conf.port
		}
		url += path
		return url
	}

	/**
	Return true if the server is started
	@returns {boolean}
	*/
	isStarted():boolean { return this.started }

	private checkMigrateConf(config?:any):void {
		config = config || {}
		if (config.dev && config.dev.web) {
			return config
		}
		let database
		try {
			let content = fs.readFileSync(path.join(this.app.path, 'database.json')).toString()
			database = JSON.parse(content)
		} catch(e) {
			if (e.code != 'ENOENT') {
				throw e
			}
			database = {}
		}

		if ( ! Object.keys(config).length) {
			config = {
				host: 'localhost',
				port: 8080
			}
		}

		//flatten confs
		config = {
			dev: config.dev || config,
			prod: config.prod
		}
		delete config.dev.prod
		database = {
			dev: this.app.database._confToJson(database.dev || database),
			prod: this.app.database._confToJson(database.prod)
		}

		this.config = {
			dev: {
				web: config.dev,
				database: database.dev
			}
		}

		if (config.prod || database.prod) {
			this.config.prod = {
				web: config.prod,
				database: database.prod
			}
		}

		fs.writeFileSync(path.join(this.app.path, 'server.json'), JSON.stringify(this.toJson(), null, '\t'))
		if (fs.existsSync(path.join(this.app.path, 'database.json'))) {
			fs.unlinkSync(path.join(this.app.path, 'database.json'))
		}
	}

	reloadConfig():void {
		this.config = {}
		try {
			let content = fs.readFileSync(path.join(this.app.path, 'server.json')).toString()
			this.config = JSON.parse(content)
		}
		catch (e) {
			if (e.code != 'ENOENT') {
				throw e
			}
		}
		this.checkMigrateConf(this.config)
	}

	/**
	Get the server configuration
	@param {string} - The environment mode. ConfigType.DEVELOPMENT or ConfigType.PRODUCTION.
	@returns {object}
	*/
	getConfig(mode?:AppMode, type?:ConfigType, options?:IConfigOptions):IWebServerConfig|IDatabaseServerConfig {
		type = type || ConfigType.WEB
		options = options || {live: this.app.live}
		if ( ! this.config) {
			this.reloadConfig()
		}

		if ( ! mode) {
			mode = this.app.mode
		}

		if ( ! this.config[mode]) {
			return null
		}

		let result = this.config[mode][type]

		if (options.live && result && result.live) {
			result = result.live
		}

		return result
	}

	/**
	Set the web configuration
	@param {object} - The configuration object
	@param {string} - The environment mode. `development` or `production`.
	*/
	setConfig(config: IWebServerConfig|IDatabaseServerConfig, mode: AppMode, type?:ConfigType, options?: IConfigOptions, opts?: ISaveOptions):void {
		options = options || {}
		if ( type == ConfigType.WEB && (! config.host || ! config.port) ) {
			if (mode == AppMode.DEVELOPMENT) {
				throw new Error('Missing host/port')
			} else {
				config = undefined
			}
		}

		if ( ! this.config) {
			this.reloadConfig()
		}
		if ( ! this.config[mode]) {
			this.config[mode] = {}
		}

		let conf: IWebServerConfig|IDatabaseServerConfig
		if (type == ConfigType.WEB) {
			conf = config && {
				host: config.host,
				port: config.port
			}
		} else if (type == ConfigType.DATABASE) {
			conf = this.app.database._confToJson(<IDatabaseServerConfig> config)
		}

		if (options.live) {
			if ( ! this.config[mode][type]) {
				this.config[mode][type] = {}
			}
			this.config[mode][type].live = conf
		} else {
			let live = this.config[mode][type] && this.config[mode][type].live
			this.config[mode][type] = conf
			if (this.config[mode][type] && live) {
				this.config[mode][type].live = live
			}
		}

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

			if (this.disabled) {
				this.app.logger.log('INFO: The server is disabled on this machine.')
				return Promise.resolve()
			}

			let config = this.getConfig()
			return new Promise((resolve, reject) => {
				let errListener = (e) => {
					let err
					if (e.code == 'EADDRINUSE') {
						err = new Error('Error while starting the server: The port is already used by another server.')
					}
					else {
						err = new Error('Error while starting the server: ' + e.message)
					}
					err.originalError = e
					this.app.logger.error(err)
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