
import * as fs from 'fs'
import * as path from 'path'

import App, { AppMode } from './app'

const fse = require('fs-extra')

export class Migration {

	constructor(private app: App) {
	}

	// migration from 0.3.2: merge database.json in server.json
	private checkMigrateDatabaseConf():Promise<boolean> {
		let newconfig:any = {}
		try {
			let content = fs.readFileSync(path.join(this.app.path, 'server.json')).toString()
			newconfig = JSON.parse(content)
		}
		catch (e) {
			return Promise.resolve(false)
		}
		if (newconfig.dev && newconfig.dev.web) {
			return Promise.resolve(false)
		}
		let config = newconfig
		let database
		try {
			let content = fs.readFileSync(path.join(this.app.path, 'database.json')).toString()
			database = JSON.parse(content)
		} catch(e) {
			if (e.code != 'ENOENT') {
				return Promise.reject(e)
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

		newconfig = {
			dev: {
				web: config.dev,
				database: database.dev
			}
		}

		if (config.prod || database.prod) {
			newconfig.prod = {
				web: config.prod,
				database: database.prod
			}
		}

		fs.writeFileSync(path.join(this.app.path, 'server.json'), JSON.stringify(newconfig, null, '\t'))
		if (fs.existsSync(path.join(this.app.path, 'database.json'))) {
			fs.unlinkSync(path.join(this.app.path, 'database.json'))
		}
		return Promise.resolve(true)
	}

	// migration from 0.4.0: better structure (materia-designer#60)
	private checkMigrateServer():Promise<boolean> {
		let materiaConf
		try {
			let content = fs.readFileSync(path.join(this.app.path, 'materia.json')).toString()
			materiaConf = JSON.parse(content)
		}
		catch (e) {
			if (e.code != 'ENOENT') {
				return Promise.reject(e)
			} else {
				return Promise.resolve(false)
			}
		}

		let pkg
		try {
			let content = fs.readFileSync(path.join(this.app.path, 'package.json')).toString()
			let pkg = JSON.parse(content)
		}
		catch (e) {
			if (e.code != 'ENOENT') {
				return Promise.reject(e)
			} else {
				pkg = {
					"name": materiaConf.name,
					"version": "1.0.0",
					"description": "",
					"main": "index.js",
					"scripts": {
						"start": "materia start --prod",
						"test": "echo \"Error: no test specified\" && exit 1"
					},
					"author": "",
					"license": "ISC"
				}
			}
		}

		pkg.materia = pkg.materia || {}
		if (materiaConf.icon) {
			pkg.materia.icon = materiaConf.icon
		}
		if (materiaConf.addons) {
			pkg.materia.addons = materiaConf.addons
		}

		//...

		new Promise((accept, reject) => {
			fse.mkdirs(path.join(this.app.path, 'server'), (err) => {
				if (err) {
					return reject(err)
				}
				accept()
			})
		}).then(() => {
			if (fs.existsSync(path.join(this.app.path, 'server.json'))) {
				return new Promise((accept, reject) => {
					fse.move(path.join(this.app.path, 'server.json'), path.join(this.app.path, 'server', 'server.json'), (err) => {
						if (err) {
							return reject(err)
						}
						accept()
					})
				})
			}
		}).then(() => {
			if (fs.existsSync(path.join(this.app.path, 'api.json'))) {
				return new Promise((accept, reject) => {
					fse.move(path.join(this.app.path, 'api.json'), path.join(this.app.path, 'server', 'api.json'), (err) => {
						if (err) {
							return reject(err)
						}
						accept()
					})
				})
			}
		}).then(() => {
			if (fs.existsSync(path.join(this.app.path, 'entities'))) {
				return new Promise((accept, reject) => {
					fse.move(path.join(this.app.path, 'entities'), path.join(this.app.path, 'server', 'models'), (err) => {
						if (err) {
							return reject(err)
						}
						accept()
					})
				})
			}
		}).then(() => {
			if (fs.existsSync(path.join(this.app.path, 'endpoints'))) {
				return new Promise((accept, reject) => {
					fse.move(path.join(this.app.path, 'endpoints'), path.join(this.app.path, 'server', 'controllers'), (err) => {
						if (err) {
							return reject(err)
						}
						accept()
					})
				})
			}
		}).then(() => {
			return new Promise((accept, reject) => {
				let modelsPath = path.join(this.app.path, 'server', 'models')
				fs.readdir(modelsPath, (err, files) => {
					if (err) {
						return reject(err)
					}
					for (let file of files) {
						let content = fs.readFileSync(path.relative(modelsPath, file)).toString()
						content = content.replace(/entities[\/\\]queries/g, path.join('server', 'models', 'queries'))
						fs.writeFileSync(path.relative(modelsPath, file), content)
					}
					accept()
				})
			})
		}).then(() => {
			fs.writeFileSync(path.join(this.app.path, 'package.json'), JSON.stringify(pkg, null, 2))
			if (fs.existsSync(path.join(this.app.path, 'materia.json'))) {
				fs.unlinkSync(path.join(this.app.path, 'materia.json'))
			}
			return true
		})
	}

	check():Promise<any> {
		return this.checkMigrateDatabaseConf().then(migrate => {
			if (migrate) {
				this.app.logger.warn('Migrated from 0.3.2 structure')
			}
			return this.checkMigrateServer()
		}).then(migrate => {
			if (migrate) {
				this.app.logger.warn('Migrated from 0.4.0 structure')
			}
		})
	}
}