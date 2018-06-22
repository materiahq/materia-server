import * as fs from "fs";
import * as path from "path";

import { App, AppMode, ISaveOptions } from "./app";
// import { ScriptMode } from "./client";
// import { MateriaError } from "./error";

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
	links?: {
		dev: string[];
		prod: string[];
	};
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
	LINKS = <any>"links",
	DEPLOYMENT = <any>"deployment",
	SERVICES = <any>"services"
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

	private generateUrlFromConf(server: IServerConfig) {
		return `http${server.ssl ? 's' :''}://${server.host}${server.port != 80 ? ':' + server.port.toString() : ''}/`
	}

	reloadConfig(): void {
		// console.log('load', this.materiaJson);
		this.loadConfigurationFiles();
		this.config = {
			app: {
				name: this.materiaJson.name,
				package: this.packageJson.name,
				version: this.packageJson.version,
				icon: this.materiaJson.icon,
				rootPassword: this.app.mode == AppMode.PRODUCTION && this.materiaProdJson.rootPassword
					? this.materiaProdJson.rootPassword
					: this.materiaJson.rootPassword,
				live: {
					url: this.materiaProdJson.url || this.generateUrlFromConf(this.materiaProdJson.server),
					rootPassword: this.materiaProdJson.rootPassword ? this.materiaProdJson.rootPassword : this.materiaJson.rootPassword
				}
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
			addons: {
				dev: this.materiaJson.addons,
				prod: Object.assign(
					{},
					this.materiaJson.addons,
					this.materiaProdJson.addons
				)
			},
			links: {
				dev: this.materiaJson.links || [],
				prod: this.materiaProdJson.links || []
			}
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
			this.loadConfigurationFiles();
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
			ConfigType.LINKS,
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
			this.loadConfigurationFiles();
			this.reloadConfig();
		}
		if (!this.config[type]) {
			this.config[type] = {};
		}

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
	}

	save(opts?: ISaveOptions) {
		if (opts && opts.beforeSave) {
			opts.beforeSave("materia.json");
			opts.beforeSave("package.json");
		}
		const res = this.toJson()
		this.packageJson = res.package
		this.materiaJson = res.materia
		this.materiaProdJson = res.materiaProd
		this.reloadConfig();
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
				rootPassword: this.app.rootPassword,
				icon: this.app.icon,
				server: this.config.server && this.config.server.dev,
				database: this.config.database && this.config.database.dev,
				session: this.config.session && this.config.session.dev,
				client: this.config.client,
				addons: this.config.addons && this.config.addons.dev,
				links: this.config.links && this.config.links.dev,
				git: this.config.git
			}),
			materiaProd: Object.assign({}, this.materiaProdJson, {
				url: this.config.app && this.config.app.live && this.config.app.live.url,
				rootPassword: this.config.app && this.config.app.live && this.config.app.live.rootPassword,
				server: this.config.server && this.config.server.prod,
				database: this.config.database && this.config.database.prod,
				session: this.config.session && this.config.session.prod,
				addons: this.config.addons && this.config.addons.prod,
				links: this.config.links && this.config.links.prod
			}),
			package: Object.assign({}, this.packageJson, {
				name: this.app.package,
				version: this.app.version,
				scripts: this.config.scripts,
				dependencies: this.config.dependencies.prod,
				devDependencies: this.config.dependencies.dev,
				// engine: {
				// 	node: ''
				// }
			})
		};
		// return this.config;
	}
}
