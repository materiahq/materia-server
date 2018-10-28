import { App, ConfigType, AppMode } from '../../lib';
import { DatabaseLib } from './database.ctrl';
import { WebsocketInstance } from '../../lib/websocket';
import { IClientConfig, IAppConfig } from '@materia/interfaces';
import * as path from 'path';

export class AppController {
	constructor(private app: App, websocket: WebsocketInstance) { }
	entitySpacing = 20;

	restart(req, res) {
		this.app.stop().then(() => this.app.start());
		res.status(200).json({
			message: 'Shutting down the server... waiting for restart.'
		});
	}

	private saveServerSettings(app, settings, mode) {
		if (
			settings.server[mode] &&
			settings.server[mode].host &&
			settings.server[mode].host
		) {
			return app.config.set(
				settings.server[mode],
				mode,
				ConfigType.SERVER,
				{
					live: false
				}
			);
		}
	}

	private saveDatabaseSettings(app, settings, mode) {
		if (settings.database && settings.database[mode]) {
			if (
				settings.database[mode].type &&
				settings.database[mode].type == 'sqlite'
			) {
				delete settings.database[mode].host;
				delete settings.database[mode].port;
				delete settings.database[mode].database;
				delete settings.database[mode].username;
				delete settings.database[mode].password;
			} else {
				delete settings.database[mode].storage;
			}
			return app.config.set(
				settings.database[mode],
				mode,
				ConfigType.DATABASE,
				{ live: false }
			);
		}
	}

	private saveClientSettings(app: App, settings: any) {
		if (settings.client) {
			const client = settings.client;
			if (client.packageJson) {
				app.config.set(client.packageJson.devDependencies, 'dev', ConfigType.DEPENDENCIES)
				app.config.set(client.packageJson.dependencies, 'prod', ConfigType.DEPENDENCIES)
				app.config.set(client.packageJson.scripts, 'dev', ConfigType.SCRIPTS)
				delete client.packageJson
			}

			const clientToSave: IClientConfig = {
				www: client.www
			}
			if (client.www) {
				this.app.server.dynamicStatic.setPath(path.join(this.app.path, client.www));
				if (client.packageJsonPath) {
					clientToSave.packageJsonPath = client.packageJsonPath
				} else if (client.build && client.build.enabled) {
					clientToSave.build = true;
				}
				if (client.scripts && (client.scripts.build || client.scripts.watch || client.scripts.prod)) {
					clientToSave.scripts = {}
					if (client.scripts.build) {
						clientToSave.scripts.build = client.scripts.build;
					}
					if (client.scripts.watch) {
						clientToSave.scripts.watch = client.scripts.watch;
					}
					if (client.scripts.prod) {
						clientToSave.scripts.prod = client.scripts.prod;
					}
				}
				if (client.autoWatch) {
					clientToSave.autoWatch = client.autoWatch;
				}
				app.config.set(clientToSave, 'dev', ConfigType.CLIENT);
			} else {
				app.config.delete(ConfigType.CLIENT);
			}

		}

	}

	config(req, res) {
		const settings = req.body;

		this.app.name = settings.general.name;
		this.app.package = settings.general.package;
		this.app.icon = settings.general.icon;

		const appConfig = this.app.config.get<IAppConfig>(AppMode.DEVELOPMENT, ConfigType.APP)
		this.app.config.set({
			name: settings.general.name,
			package: settings.general.package,
			icon: settings.general.icon,
			version: appConfig.version,
			rootPassword: settings.general.rootPassword,
			live: {
				url: settings.general.live && settings.general.live.url,
				rootPassword: settings.general.live && settings.general.live.rootPassword
			}
		}, AppMode.DEVELOPMENT, ConfigType.APP)

		this.saveServerSettings(this.app, settings, 'dev');
		this.saveServerSettings(this.app, settings, 'prod');

		this.saveDatabaseSettings(this.app, settings, 'dev');
		this.saveDatabaseSettings(this.app, settings, 'prod');

		this.saveClientSettings(this.app, settings);

		this.app.config.save()
			.then(() => {
				settings.general.id = this.app.id;
				res.status(200).json(settings);
			})
			.catch(e => {
				res.status(500).json(e);
			});
	}

	deleteConfig(req, res) {
		const type = req.query.type;
		const mode = req.query.mode || null;
		this.app.config.delete(type, mode);
		this.app.config.save()
			.then(() => {
				res.status(200).send(true);
			})
			.catch(e => {
				res.status(500).json(e);
			});
	}

	search(req, res) { }

	getMinimalInfo(req, res) {
		res.status(200).json({
			id: this.app.id,
			package: this.app.package,
			name: this.app.name,
			path: this.app.path,
			icon: this.app.icon, // this.app.infos && this.app.infos.icon ? this.app.infos.icon.color : null,
			hasStatic: this.app.server.hasStatic(),
			url: this.app.server.getBaseUrl('/'),
			mode: this.app.mode.toString(),
			addons: this.app.addons.findAll().map(addon =>
				Object.assign({}, addon.toJson(), {
					setupConfig: addon.getSetupConfig(),
					config: addon.config,
					enabled: addon.enabled,
					installed: true,
					installing: false,
					published: true // TODO: set published dynamically (still need to find how to detect if an addon is published or not)
				})
			)
		});
	}

	getInfos(req, res) {
		const appConf = this.app.config.get<any>('dev', ConfigType.APP);
		res.status(200).json({
			id: this.app.id,
			package: this.app.package,
			name: this.app.name,
			path: this.app.path,
			icon: this.app.icon,
			hasStatic: this.app.server.hasStatic(),
			url: this.app.server.getBaseUrl('/'),
			live: {
				url: appConf.live && appConf.live.url || this.app.server.getBaseUrl('/'),
			},
			mode: this.app.mode.toString(),
			database: {
				disabled: this.app.database.disabled,
				config: {
					dev: this.app.config.get('dev', ConfigType.DATABASE),
					prod: this.app.config.get('prod', ConfigType.DATABASE)
				}
			},

			server: {
				dev: this.app.config.get('dev', ConfigType.SERVER),
				prod: this.app.config.get('prod', ConfigType.SERVER)
			},

			client: this.app.config.get('dev', ConfigType.CLIENT),
			entities: DatabaseLib.loadEntitiesJson(this.app),
			relations: this.app.entities.findAllRelations({ implicit: true }),
			api: this.app.api.findAll().map(api => {
				return Object.assign({}, api.toJson(), {
					fromAddon: api.fromAddon
						? {
							name: api.fromAddon.name,
							logo: api.fromAddon.logo,
							package: api.fromAddon.package,
							path: api.fromAddon.path
						}
						: {},
					params: api.getAllParams(),
					data: api.getAllData()
				});
			}),
			permissions: this.app.api.permissions.findAll().map(permission => {
				return Object.assign({}, permission.toJson(), {
					code: `module.exports = ${permission.middleware.toString()}`,
					file: permission.file
				});
			}),
			controllers: this.app.api.getControllers(),
			addons: this.app.addons.findAll().map(addon =>
				Object.assign({}, addon.toJson(), {
					setupConfig: addon.getSetupConfig(),
					config: addon.config,
					enabled: addon.enabled,
					installed: true,
					installing: false,
					published: true // TODO: set published dynamically (still need to find how to detect if an addon is published or not)
				})
			),
			models: this.app.entities.getModels()
		});
	}
}
