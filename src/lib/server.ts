import * as fs from 'fs'
import * as path from 'path'

import App, { AppMode } from './app'
import { ConfigType, IWebConfig, IConfigOptions } from './config'
import MateriaError from './error'

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

/**
 * @class Server
 * @classdesc
 * Represent the server
 */
export class Server {
	started: boolean = false

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
			cookie: { maxAge: 3600000 },
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

		this.app.logger.log(` └── Server: OK`)
	}

	/**
	Get the base url for endpoints
	@returns {string}
	*/
	getBaseUrl(path?:string, mode?:AppMode, options?:IConfigOptions) {
		path = path || '/api'
		let conf = this.app.config.get<IWebConfig>(mode, ConfigType.WEB, options)
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

	/**
	Return true if the server has a static page
	@returns {boolean}
	*/
	hasStatic() {
		return fs.existsSync(path.join(this.app.path, 'web', 'index.html'))
	}

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
				this.app.logger.log(' └── Server: Disabled (Warning)')
				return Promise.resolve()
			}

			let config = this.app.config.get<IWebConfig>()
			return new Promise((resolve, reject) => {
				let port = this.app.options.port || config.port

				let errListener = (e) => {
					let err
					if (e.code == 'EADDRINUSE') {
						err = new MateriaError(`Error while starting the server: The port ${port} is already used by another server.`)
					}
					else {
						err = new MateriaError('Error while starting the server: ' + e.message)
					}
					err.originalError = e
					this.app.logger.error(err)
					return reject(err)
				}

				let args = [port, config.host, () => {
					this.started = true
					this.app.logger.log(' └─┬ Server: Started')
					this.app.logger.log(`   └─ Listening on http://${config.host}:${port}`)
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
				this.app.logger.log('\n(Stop) Server closed\n')
				this.started = false
				accept()
			})
		})
	}
}