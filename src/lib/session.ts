import * as session from 'express-session';
import { ISessionConfig } from '@materia/interfaces';

import { App, AppMode } from './app';
import { ConfigType } from './config';
import { DBEntity } from './entities/db-entity';

const SequelizeStore = require('connect-session-sequelize')(session.Store);

export class Session {

	constructor(private app: App) {	}

	initialize(): Promise<any> {
		if (this.app.mode == AppMode.PRODUCTION && ! this.app.database.disabled && ! this.app.live) {
			return this.app.entities.add({
				name: 'materia_session',
				fields: [
					{
						'name': 'sid',
						'type': 'text',
						'required': true,
						'primary': true,
						'unique': true,
						'default': false,
						'autoIncrement': false,
						'read': true,
						'write': true
					},
					{
						'name': 'expires',
						'type': 'date',
						'required': true,
						'primary': false,
						'unique': false,
						'default': false,
						'read': true,
						'write': true
					},
					{
						'name': 'data',
						'type': 'text',
						'required': true,
						'primary': false,
						'unique': false,
						'default': false,
						'read': true,
						'write': true
					}
				],
				queries: [
					{
						id: 'clearExpired',
						type: 'delete',
						opts: {
							conditions: [
								{
									field: 'expires',
									operator: '<',
									value: ':now'
								}
							]
						}
					}
				]
			}, {
				apply: true
			}).then((dbEntity: DBEntity) => {
				this.setupMiddleware(dbEntity);
			});
		} else {
			this.setupMiddleware();
			return Promise.resolve();
		}
	}

	setupMiddleware(dbEntity?: DBEntity) {
		const sessionConfig = this.app.config.get<ISessionConfig>(this.app.mode, ConfigType.SESSION);

		let secret = 'keyboard cat';
		if (sessionConfig && sessionConfig.secret) {
			secret = sessionConfig.secret;
		}

		let maxAge = 3600000;
		if (sessionConfig && sessionConfig.maxAge) {
			maxAge = sessionConfig.maxAge;
		}

		let store;
		if (dbEntity) {
			store = new SequelizeStore({
				db: this.app.database.sequelize,
				table: 'materia_session'
			});
		}

		const config = {
			secret: secret,
			cookie: { maxAge: maxAge },
			resave: false,
			saveUninitialized: false
		} as any;

		if (store) {
			config.store = store;
		}

		this.app.server.expressApp.use(session(config));
	}
}