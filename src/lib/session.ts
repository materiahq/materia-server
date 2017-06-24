import App, {AppMode} from './app'
import { ConfigType, ISessionConfig } from './config'
import {DBEntity} from './entities/db-entity'
import * as session from 'express-session'

const SequelStore = require('sequelstore-connect')(session)

export class Session {
	constructor(private app: App) {

	}

	initialize():Promise<any> {
		if (this.app.mode == AppMode.PRODUCTION && ! this.app.database.disabled && ! this.app.live) {
			return this.app.entities.add({
				name: 'materia_session',
				fields: [
					{
						"name": "session_id",
						"type": "text",
						"required": true,
						"primary": true,
						"unique": true,
						"default": false,
						"autoIncrement": false,
						"read": true,
						"write": true
					},
					{
						"name": "expires",
						"type": "number",
						"required": true,
						"primary": false,
						"unique": false,
						"default": false,
						"read": true,
						"write": true
					},
					{
						"name": "data",
						"type": "text",
						"required": true,
						"primary": false,
						"unique": false,
						"default": false,
						"read": true,
						"write": true
					}
				],
				queries: [
					{
						id: 'clearExpired',
						type: 'delete',
						opts: {
							conditions: [
								{
									field: "expires",
									operator: "<",
									value: ":now"
								}
							]
						}
					}
				]
			}, {
				apply: true
			}).then(obj => {
				let ent = obj as DBEntity
				this.setupMiddleware(ent)
			})
		}
		else {
			this.setupMiddleware()
			return Promise.resolve()
		}
	}

	setupMiddleware(obj?:DBEntity) {
		let sessionConfig = this.app.config.get<ISessionConfig>(this.app.mode, ConfigType.SESSION)

		let store;
		if (this.app.mode == AppMode.PRODUCTION && ! this.app.database.disabled && ! this.app.live) {
			let entity = this.app.entities.get('materia_session') as DBEntity
			store = new SequelStore({
				database: this.app.database.sequelize,
				sessionModel: entity.model
			})
		}

		let secret = 'keyboard cat'
		if (sessionConfig && sessionConfig.secret) {
			secret = sessionConfig.secret
		}

		let maxAge = 3600000
		if (sessionConfig && sessionConfig.maxAge) {
			maxAge = sessionConfig.maxAge
		}

		let config = {
			secret: secret,
			cookie: { maxAge: maxAge },
			resave: false,
			saveUninitialized: false
		} as any

		if (store) {
			config.store = store
		}

		console.log(config)

		this.app.server.expressApp.use(session(config))
	}
}