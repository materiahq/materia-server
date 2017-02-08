import * as fs from 'fs'
import * as path from 'path'

import * as fse from 'fs-extra'
import * as request from 'request'

import * as chaiAsPromised from 'chai-as-promised'

import App, { AppMode } from '../../lib/app'
import { ConfigType } from '../../lib/config'

chaiAsPromised['transferPromiseness'] = (assertion, promise) => {
	assertion.then = promise.then.bind(promise);
	assertion.catch = promise.catch.bind(promise);
};

export class TemplateApp {
	private name:string
	private request:request.RequestAPI<request.Request, request.CoreOptions, request.RequiredUriUrl>
	private before_creation: (new_app:App)=>any

	constructor(name) {
		this.name = name
		this.before_creation = ()=>{}
	}

	beforeCreate(before_creation:(new_app:App)=>any) {
		this.before_creation = before_creation
	}

	createInstance():App {
		let app_path = fs.mkdtempSync((process.env.TMPDIR || '/tmp/') + 'materia-test-')
		fse.copySync(path.join(__dirname, '..', '..', '..', 'src', 'test', 'apps', this.name), app_path, { clobber:true, recursive:true })

		this.request = request.defaults({
			json: true
		})

		return this.createApp(app_path)
	}

	createApp(app_path:string):App {
		const debug_mode = !! process.env.DEBUG
		let app = new App(app_path, {logRequests:debug_mode, logSql:debug_mode})

		app.config.set({
			"host": "localhost",
			"port": 8798
		}, AppMode.DEVELOPMENT, ConfigType.WEB)

		if (process.env.DIALECT == "postgres") {
			app.config.set({
				"type": "postgres",
				"host": process.env.POSTGRES_HOST,
				"port": process.env.POSTGRES_PORT,
				"username": process.env.POSTGRES_USERNAME,
				"password": process.env.POSTGRES_PASSWORD,
				"database": process.env.POSTGRES_DATABASE,
			}, AppMode.DEVELOPMENT, ConfigType.DATABASE )
		} else {
			app.config.set({
				"type": "sqlite"
			}, AppMode.DEVELOPMENT, ConfigType.DATABASE )
		}

		if ( ! debug_mode) {
			app.logger.setConsole({
				log: function() {},
				warn: function() {},
				error: function() {}
			})
		}
		return app
	}

	runApp():Promise<App> {
		let app = this.createInstance()
		let off = Promise.resolve(this.before_creation(app))
		return off.then(() => app.load()).then(() => {
			if (process.env.DIALECT == "postgres") {
				let p = Promise.resolve();
				[
					"DROP SCHEMA public CASCADE",
					"CREATE SCHEMA public",
					"GRANT ALL ON SCHEMA public TO postgres",
					"GRANT ALL ON SCHEMA public TO public"
				].forEach(q => p = p.then(() => app.database.sequelize.query(q, {raw: true})))
				return p
			}
		}).then(() => app.start()).then(() => app)
	}

	resetApp(app:App, while_off?:(new_app:App)=>any):Promise<App> {
		let new_app: App
		return app.stop().then(() => {
			new_app = this.createApp(app.path)
			return Promise.resolve(this.before_creation(app))
		}).then(() => while_off ? Promise.resolve(while_off(app)) : Promise.resolve())
		.then(() => new_app.load()).then(() => new_app.start())
		.catch(e => {
			return app.start().then(() => {
				throw e
			})
		}).then(() => {
			return new_app
		})
	}

	private promisifyRequest(method, url, args) {
		args = args.map(arg => arg)
		args.unshift("http://localhost:8798" + url)
		return new Promise((accept, reject) => {
			args.push((err, httpResponse, body) => {
				if (err) {
					return reject(err)
				}
				if (httpResponse.statusCode != 200) {
					return reject(new Error(JSON.stringify(body)))
				}
				return accept(body)
			})
			this.request[method].apply(this.request, args)
		})
	}

	get(url, ...args) {
		return this.promisifyRequest('get', url, args)
	}
	post(url, ...args) {
		return this.promisifyRequest('post', url, args)
	}
	put(url, ...args) {
		return this.promisifyRequest('put', url, args)
	}
	del(url, ...args) {
		return this.promisifyRequest('del', url, args)
	}

	dbBoolean(val) {
		if ( val === undefined || val === null )
			return val
		if ( ! process.env.DIALECT || process.env.DIALECT == "sqlite") {
			return val ? 1 : 0
		} else {
			return val
		}
	}
}