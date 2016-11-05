
import * as fs from 'fs'
import * as path from 'path'

import App, { AppMode, ISaveOptions } from './app'

export interface IWebConfig {
	port: number,
	host: string,
	live?: IWebConfig
}

export interface IDatabaseConfig {
	type: string
	host?: string
	port?: number
	username?: string
	password?: string
	database?: string
	storage?: string
	live?: IDatabaseConfig
}

export interface IGitConfig {
	remote: string
	branch: string
}

export interface IFullServerConfig {
	dev?: {
		web: IWebConfig
		database?: IDatabaseConfig
	}
	prod?: {
		web: IWebConfig
		database?: IDatabaseConfig
		git?: IGitConfig
	}
}

export enum ConfigType {
	WEB = <any>"web",
	DATABASE = <any>"database",
	GIT = <any>"git"
}

export interface IConfigOptions {
	live?: boolean
}

export class Config {
	config: IFullServerConfig

	constructor(private app: App) {
	}

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
	@param {string} - The environment mode. AppMode.DEVELOPMENT or AppMode.PRODUCTION.
	@returns {object}
	*/
	get<T>(mode?:AppMode, type?:ConfigType, options?:IConfigOptions):T {
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
	set(config: IWebConfig|IDatabaseConfig|IGitConfig, mode: AppMode, type?:ConfigType, options?: IConfigOptions, opts?: ISaveOptions):void {
		options = options || {}
		let webConfig = <IWebConfig> config
		if ( type == ConfigType.WEB && (! webConfig.host || ! webConfig.port) ) {
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

		let conf: IWebConfig|IDatabaseConfig|IGitConfig
		if (type == ConfigType.WEB) {
			conf = webConfig && {
				host: webConfig.host,
				port: webConfig.port
			}
		} else if (type == ConfigType.DATABASE) {
			conf = this.app.database._confToJson(<IDatabaseConfig> config)
		} else if (type == ConfigType.GIT) {
			let gitConfig = <IGitConfig> config
			conf = gitConfig && {
				remote: gitConfig.remote,
				branch: gitConfig.branch
			}
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
	Return the server's configuration
	@returns {object}
	*/
	toJson() { return this.config }
}