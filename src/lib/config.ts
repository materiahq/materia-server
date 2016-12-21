
import * as fs from 'fs'
import * as path from 'path'

import App, { AppMode, ISaveOptions } from './app'
import MateriaError from './error'

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

	reloadConfig():void {
		this.config = {}
		try {
			let content = fs.readFileSync(path.join(this.app.path, 'server', 'server.json')).toString()
			this.config = JSON.parse(content)
		}
		catch (e) {
			if (e.code != 'ENOENT') {
				throw e
			} else {
				this.config = {
					dev: {
						web: {
							host: 'localhost',
							port: 8080
						}
					}
				}
			}
		}
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
				throw new MateriaError('Missing host/port')
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
			opts.beforeSave(path.join('server', 'server.json'))
		}
		this.app.saveFile(path.join(this.app.path, 'server', 'server.json'), JSON.stringify(this.toJson(), null, '\t'), { mkdir: true }).catch(e => {
			if (opts && opts.afterSave) {
				opts.afterSave()
			}
			throw e
		}).then(() => {
			if (opts && opts.afterSave) {
				opts.afterSave()
			}
		})
	}

	/**
	Return the server's configuration
	@returns {object}
	*/
	toJson() { return this.config }
}