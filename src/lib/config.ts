import * as fs from "fs";
import * as path from "path";

import { App, AppMode, ISaveOptions } from "./app";
import { ScriptMode } from "./client";
import { MateriaError } from "./error";

import {
	IAppConfig,
	IGitConfig,
	IServerConfig,
	IClientConfig,
	IPackageJson,
	IServer,
	ISessionConfig,
	IMateriaJson,
	IDatabaseConfig,
	IDatabase,
	ISession
} from "@materia/interfaces";

export interface IFullConfig {
	app: IAppConfig;
	git?: IGitConfig;
	server: IServer;
	session?: ISession;
	dependencies?: {
		dev: {
			[command: string]: string;
		}
		prod: {
			[command: string]: string;
		}
	};
	database?: IDatabase;
	addons?: any;
	client?: IClientConfig;
}

export enum ConfigType {
	APP = <any>"app",
	SERVER = <any>"server",
	DATABASE = <any>"database",
	GIT = <any>"git",
	SESSION = <any>"session",
	CLIENT = <any>"client",
	DEPENDENCIES = <any>"dependencies",
	ADDONS = <any>"addons",
	DEPLOYMENT = <any>"deployment"
}

export interface IConfigOptions {
	live?: boolean;
}

export class Config {
	config: IFullConfig;

	packageJson: IPackageJson;
	materiaJson: IMateriaJson;
	materiaProdJson: any;

	constructor(private app: App) {}

	private loadConfigurationFiles() {
		this.config = null;
		try {
			this.packageJson = JSON.parse(
				fs.readFileSync(
					path.join(this.app.path, "package.json"),
					"utf-8"
				)
			);
		} catch (e) {
			this.packageJson = {
				name: "untitled",
				version: "0.0.1",
				scripts: {},
				dependencies: {
					"@materia/server": "1.0.0"
				}
			};
		}

		try {
			this.materiaJson = JSON.parse(
				fs.readFileSync(
					path.join(this.app.path, "materia.json"),
					"utf-8"
				)
			);
		} catch (e) {
			console.log(e);
			this.materiaJson = {
				name: "Untitled App",
				server: {
					host: "localhost",
					port: 8080
				}
			};
		}

		try {
			this.materiaProdJson = JSON.parse(
				fs.readFileSync(
					path.join(this.app.path, "materia.prod.json"),
					"utf-8"
				)
			);
		} catch (e) {
			this.materiaProdJson = {};
		}
	}

	reloadConfig(): void {
		this.loadConfigurationFiles();

		this.config = {
			app: {
				name: this.materiaJson.name,
				package: this.packageJson.name,
				version: this.packageJson.version,
				icon: this.materiaJson.icon
			},
			client: this.materiaJson.client,
			git: this.materiaJson.git,
			server: {
				dev: this.materiaJson.server,
				prod: Object.assign(
					{},
					this.materiaJson.server,
					this.materiaProdJson.server
				)
			},
			session: {
				dev: this.materiaJson.session,
				prod: this.materiaProdJson.session
			},
			database: {
				dev: this.materiaJson.database,
				prod: Object.assign(
					{},
					this.materiaJson.database,
					this.materiaProdJson.database
				)
			},
			dependencies: {
				dev: this.packageJson.devDependencies,
				prod: this.packageJson.dependencies
			},
			addons: this.materiaJson.addons
		};
	}

	/**
	Get the server configuration
	@param {string} - The environment mode. AppMode.DEVELOPMENT or AppMode.PRODUCTION.
	@returns {object}
	*/
	get<T>(
		mode?: AppMode | string,
		type?: ConfigType,
		options?: IConfigOptions
	): T {
		type = type || ConfigType.SERVER;
		options = options || { live: this.app.live };
		if (!this.config) {
			this.reloadConfig();
		}

		if (!mode) {
			mode = this.app.mode;
		}

		if (!this.config[type]) {
			return null;
		}
		let result
		if ([ConfigType.SERVER,
			ConfigType.DATABASE,
			ConfigType.DEPENDENCIES,
			ConfigType.SESSION].find(t => t == type)) {
			result = this.config[type][mode];
		} else {
			result = this.config[type];
		}

		// if (options.live && result && result.live) {
		// 	result = result.live;
		// }

		return result;
	}

	/**
	Set the web configuration
	@param {object} - The configuration object
	@param {string} - The environment mode. `development` or `production`.
	*/
	set(
		config: IServerConfig | IDatabaseConfig | ISessionConfig | IGitConfig,
		mode: AppMode | string,
		type?: ConfigType,
		options?: IConfigOptions,
		opts?: ISaveOptions
	): void {
		options = options || {};
		let webConfig = <IServerConfig>config;
		if (type == ConfigType.SERVER && (!webConfig.host || !webConfig.port)) {
			if (mode == AppMode.DEVELOPMENT) {
				throw new MateriaError("Missing host/port");
			} else {
				config = undefined;
			}
		}

		if (!this.config) {
			this.reloadConfig();
		}
		if (!this.config[type]) {
			this.config[type] = {};
		}

		let conf: IServerConfig | IDatabaseConfig | ISessionConfig | IGitConfig;
		if (type == ConfigType.SERVER) {
			conf = webConfig && {
				host: webConfig.host,
				port: webConfig.port,
				ssl: !!webConfig.ssl
			};
		} else if (type == ConfigType.DATABASE) {
			conf = this.app.database._confToJson(<IDatabaseConfig>config);
		} else if (type == ConfigType.SESSION) {
			let sessionConfig = <ISessionConfig>config;
			conf = sessionConfig && {
				secret: sessionConfig.secret,
				maxAge: sessionConfig.maxAge
			};
		} else if (type == ConfigType.GIT) {
			let gitConfig = <IGitConfig>config;
			conf = gitConfig && {
				defaultRemote: gitConfig.defaultRemote
				// branch: gitConfig.branch
			};
		}

		if (options.live) {
			if (!this.config[mode][type]) {
				this.config[mode][type] = {};
			}
			this.config[mode][type].live = conf;
		} else {
			let live = this.config[mode][type] && this.config[mode][type].live;
			this.config[mode][type] = conf;
			if (this.config[mode][type] && live) {
				this.config[mode][type].live = live;
			}
		}

		if (opts && opts.beforeSave) {
			opts.beforeSave(path.join(".materia", "server.json"));
		}
		this.app
			.saveFile(
				path.join(this.app.path, ".materia", "server.json"),
				JSON.stringify(this.toJson(), null, "\t"),
				{ mkdir: true }
			)
			.catch(e => {
				if (opts && opts.afterSave) {
					opts.afterSave();
				}
				throw e;
			})
			.then(() => {
				if (opts && opts.afterSave) {
					opts.afterSave();
				}
			});
	}

	/**
	Return the server's configuration
	@returns {object}
	*/
	toJson() {
		return this.config;
	}
}
