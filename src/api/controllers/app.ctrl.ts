import { App, ConfigType } from "../../lib";
import { DatabaseLib } from "./database.ctrl";

export class AppController {
	constructor(private app: App) {}
	entitySpacing = 20;

	restart(req, res) {
		this.app.stop().then(() =>
			this.app.start()
		)
		res.status(200).json({
			message: 'Shutting down the server... waiting for restart.'
		})
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
		if (settings.database[mode]) {
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

	config(req, res) {
		const settings = req.body;

		this.app.name = settings.general.name;
		this.app.package = settings.general.package;
		this.app.icon = settings.general.icon;

		this.saveServerSettings(this.app, settings, 'dev');
		this.saveServerSettings(this.app, settings, 'prod');

		this.saveDatabaseSettings(this.app, settings, 'dev');
		this.saveDatabaseSettings(this.app, settings, 'prod');

		const cs = Object.assign({}, settings.client);
		if (cs.packageJson) {
			delete cs.packageJson;
		}

		if (cs.build) {
			delete cs.build;
		}

		if (cs.enabled) {
			delete cs.enabled;
		}

		this.app.config.set(cs, 'dev', ConfigType.CLIENT);

		this.app.config.save().then(() => {
			settings.general.id = this.app.id;
			res.status(200).json(settings);
		}).catch(e => {
			res.status(500).json(e);
		})
	}

	search(req, res) {}

	getMinimalInfo(req, res) {
		res.status(200).json({
			id: this.app.id,
			package: this.app.package,
			name: this.app.name,
			path: this.app.path,
			icon: this.app.icon, // this.app.infos && this.app.infos.icon ? this.app.infos.icon.color : null,
			live: this.app.live,
			hasStatic: this.app.server.hasStatic(),
			url: this.app.server.getBaseUrl('/'),
			mode: this.app.mode.toString(),
			addons: this.app.addons.findAll().map(addon =>
				Object.assign({}, addon.toJson(), {
					setupConfig: addon.getSetupConfig(),
					config: addon.config,
					installed: true,
					installing: false,
					published: true // TODO: set published dynamically (still need to find how to detect if an addon is published or not)
				})
			),
		})
	}

	getInfos(req, res) {
		res.status(200).json({
			id: this.app.id,
			package: this.app.package,
			name: this.app.name,
			path: this.app.path,
			icon: this.app.icon, // this.app.infos && this.app.infos.icon ? this.app.infos.icon.color : null,
			live: this.app.live,
			hasStatic: this.app.server.hasStatic(),
			url: this.app.server.getBaseUrl('/'),
			mode: this.app.mode.toString(),
			database: {
				disabled: this.app.database.disabled,
				config: {
					dev: this.app.config.get('dev', ConfigType.DATABASE),
					prod: this.app.config.get('prod', ConfigType.DATABASE),
					live: this.app.config.get('prod', ConfigType.DATABASE, {
						live: true
					})
				}
			},

			server: {
				dev: this.app.config.get('dev', ConfigType.SERVER),
				prod: this.app.config.get('prod', ConfigType.SERVER),
				live: this.app.config.get('prod', ConfigType.SERVER, { live: true })
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
					installed: true,
					installing: false,
					published: true // TODO: set published dynamically (still need to find how to detect if an addon is published or not)
				})
			),
			models: this.app.entities.getModels()
		})
	}
}