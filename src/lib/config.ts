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
	ISession,
	IDependencyMap,
	IScriptsMap
} from "@materia/interfaces";

export interface IAddonsConfig {
	[addon: string]: any;
}

export interface IDependenciesConfig {
	dev?: IDependencyMap;
	prod?: IDependencyMap;
}
export interface IFullConfig {
	app: IAppConfig;
	git?: IGitConfig;
	server: IServer;
	session?: ISession;
	dependencies?: IDependenciesConfig;
	scripts?: IScriptsMap;
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
	SCRIPTS = <any>"scripts",
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
		// console.log('load', this.materiaJson);
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
			scripts: this.packageJson.scripts,
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

		// console.log('get', this.config, mode, type);
		if (!this.config[type]) {
			return null;
		}
		let result
		if ([ConfigType.SERVER,
			ConfigType.DATABASE,
			ConfigType.DEPENDENCIES,
			ConfigType.ADDONS,
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
		config: IServerConfig | IDatabaseConfig | ISessionConfig | IGitConfig | IClientConfig | IDependenciesConfig | IScriptsMap,
		mode: AppMode | string,
		type?: ConfigType,
		options?: IConfigOptions,
	): void {
		options = options || {};
		if (!this.config) {
			this.reloadConfig();
		}
		if (!this.config[type]) {
			this.config[type] = {};
		}

		// let conf: IServerConfig | IDatabaseConfig | ISessionConfig | IGitConfig | IClientConfig | IDependenciesConfig | IScriptsMap;
		// if (type == ConfigType.SERVER) {
		// 	let serverConfig = <IServerConfig>config;
		// 	conf = serverConfig && {
		// 		host: serverConfig.host,
		// 		port: serverConfig.port,
		// 		ssl: !!serverConfig.ssl
		// 	};
		// } else if (type == ConfigType.DATABASE) {
		// 	conf = this.app.database._confToJson(<IDatabaseConfig>config);
		// } else if (type == ConfigType.SESSION) {
		// 	let sessionConfig = <ISessionConfig>config;
		// 	conf = sessionConfig && {
		// 		secret: sessionConfig.secret,
		// 		maxAge: sessionConfig.maxAge
		// 	};
		// } else if (type == ConfigType.GIT) {
		// 	let gitConfig = <IGitConfig>config;
		// 	conf = gitConfig && {
		// 		defaultRemote: gitConfig.defaultRemote
		// 		// branch: gitConfig.branch
		// 	};
		// } else if (type == ConfigType.CLIENT) {
		// 	conf = <IClientConfig>config;
		// } else if (type == ConfigType.DEPENDENCIES) {
		// 	conf = <IDependenciesConfig>config;
		// } else if (type == ConfigType.SCRIPTS) {
		// 	conf = <IScriptsMap>config;
		// }

		if ([
			ConfigType.SERVER,
			ConfigType.DATABASE,
			ConfigType.SESSION,
			ConfigType.DEPENDENCIES,
			ConfigType.ADDONS
		].indexOf(type) != -1) {
			this.config[type][mode] = config;
		} else {
			this.config[type] = config;
		}
		// if (options.live) {
		// 	if (!this.config[mode][type]) {
		// 		this.config[mode][type] = {};
		// 	}
		// 	this.config[mode][type].live = conf;
		// } else {
			// let live = this.config[mode][type] && this.config[mode][type].live;
			// this.config[mode][type] = conf;
			// if (this.config[mode][type] && live) {
			// 	this.config[mode][type].live = live;
			// }
		//}
	}

	save(opts?: ISaveOptions) {
		if (opts && opts.beforeSave) {
			opts.beforeSave("materia.json");
			opts.beforeSave("package.json");
		}
		const res = this.toJson()
		// console.log('save', res);
		return this.app
			.saveFile(
				path.join(this.app.path, "materia.json"),
				JSON.stringify(res.materia, null, "\t")
			)
			.then(() =>
				this.app.saveFile(
					path.join(this.app.path, "materia.prod.json"),
					JSON.stringify(res.materiaProd, null, "\t")
				)
			)
			.then(() =>
				this.app.saveFile(
					path.join(this.app.path, "package.json"),
					JSON.stringify(res.package, null, "\t")
				)
			)
			.catch(e => {
				if (opts && opts.afterSave) {
					opts.afterSave();
				}
				throw e;
			})
			.then(() => {
				// console.log('SAVED');
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
		// const newMateriaJson: any = {};
		return {
			materia: Object.assign({}, this.materiaJson, {
				name: this.app.name,
				icon: this.app.icon,
				server: this.config.server && this.config.server.dev,
				database: this.config.database && this.config.database.dev,
				session: this.config.session && this.config.session.dev,
				client: this.config.client,
				addons: this.config.addons && this.config.addons.dev,
				git: this.config.git
			}),
			materiaProd: Object.assign({}, this.materiaProdJson, {
				server: this.config.server && this.config.server.prod,
				database: this.config.database && this.config.database.prod,
				session: this.config.session && this.config.session.prod,
				addons: this.config.addons && this.config.addons.prod
			}),
			package: Object.assign({}, this.packageJson, {
				name: this.app.package,
				version: this.app.version,
				scripts: this.config.scripts,
				dependencies: this.config.dependencies.prod,
				devDependencies: this.config.dependencies.dev
			})
		};
		// return this.config;
	}
}
