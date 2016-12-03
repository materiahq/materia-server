
import * as fs from 'fs'
import * as path from 'path'

import App, { AppMode } from './app'

import * as fse from 'fs-extra'

export class Migration {

	constructor(private app: App) {
	}

	private formatName(name) {
		return name.replace(/[.\s_+()\[\]\+]/g, '-').replace(/-[a-zA-Z]/g, v => v.substr(1).toUpperCase()).replace(/-/g, '')
	}

	// migration from 0.3.2: merge database.json in server.json
	private checkMigrateDatabaseConf():Promise<boolean> {
		let newconfig:any = {}
		if (fs.existsSync(path.join(this.app.path, 'server'))) {
			return Promise.resolve(false)
		}
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
				if ( ! fs.existsSync(path.join(this.app.path, 'entities')) && ! fs.existsSync(path.join(this.app.path, 'endpoints'))) {
					return Promise.resolve(false)
				} else {
					materiaConf = {}
				}
			}
		}

		let pkg
		try {
			let content = fs.readFileSync(path.join(this.app.path, 'package.json')).toString()
			pkg = JSON.parse(content)
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

		// ---

		return new Promise((accept, reject) => {
			fse.mkdirs(path.join(this.app.path, 'server'), (err) => {
				if (err) {
					return reject(err)
				}
				accept()
			})
		}).then(() => {
			if (fs.existsSync(path.join(this.app.path, 'server.json'))) {
				return new Promise((accept, reject) => {
					fse.move(path.join(this.app.path, 'server.json'), path.join(this.app.path, 'server', 'server.json'), { clobber:true }, (err) => {
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
					fse.move(path.join(this.app.path, 'entities'), path.join(this.app.path, 'server', 'models'), { clobber:true }, (err) => {
						if (err) {
							return reject(err)
						}
						accept()
					})
				})
			}
		}).then(() => {
			let api = []
			if (fs.existsSync(path.join(this.app.path, 'api.json'))) {
				let apiJson = fs.readFileSync(path.join(this.app.path, 'api.json')).toString()
				try {
					api = JSON.parse(apiJson)
				} catch (e) {
					api = []
				}
			}

			if (fs.existsSync(path.join(this.app.path, 'endpoints'))) {
				let files = fs.readdirSync(path.join(this.app.path, 'endpoints'))
				let code = "class DefaultCtrl {\n\tconstructor(app) { this.app = app; }\n\n"
				let methods_count = 0
				for (let file of files) {
					if (/\.js$/.test(file)) {
						let method_name = this.formatName(file.replace(/\.[a-zA-Z]+$/,''))
						let endpoint_code = fs.readFileSync(path.join(this.app.path, 'endpoints', file)).toString().replace(/^(.+)$/mg, '\t\t$1')
						code += `\t${method_name}(req, res, next) {\n\t\tlet module={};\n${endpoint_code}\n`
						code += `\t\treturn Promise.resolve(module.exports(req, this.app, res));\n\t}\n`
						methods_count++
						for (let endpoint of api) {
							if (`${endpoint.file}.${endpoint.ext}` == file) {
								endpoint.controller = "default"
								endpoint.action = method_name
								delete endpoint.file
								delete endpoint.ext
							}
						}
					}
				}
				code += "}\nmodule.exports = DefaultCtrl;\n"
				if (methods_count) {
					fse.mkdirpSync(path.join(this.app.path, 'server', 'controllers'))
					fs.writeFileSync(path.join(this.app.path, 'server', 'controllers', 'default.ctrl.js'), code)
				}
				fse.removeSync(path.join(this.app.path, 'endpoints'))
			}

			if (api.length) {
				fs.writeFileSync(path.join(this.app.path, 'server', 'api.json'), JSON.stringify(api, null, '\t'))
			}
			if (fs.existsSync(path.join(this.app.path, 'api.json'))) {
				fse.removeSync(path.join(this.app.path, 'api.json'))
			}
		}).then(() => {
			if (fs.existsSync(path.join(this.app.path, 'addons'))) {
				let addons = fs.readdirSync(path.join(this.app.path, 'addons'))
				let p = Promise.resolve()
				for (let addon of addons) {
					if (fs.lstatSync(path.join(this.app.path, 'addons', addon)).isDirectory()) {
						p = p.then(() => new Promise((accept, reject) => {
							fse.move(path.join(this.app.path, 'addons', addon),
									path.join(this.app.path, 'node_modules', addon), { clobber:true }, (err) => {
								if (err) {
									return reject(err)
								}
								try {
									let addon_pkg = require(path.join(this.app.path, 'node_modules', addon, 'package.json'))
									addon_pkg.name = addon
									addon_pkg.materia = {}
									fs.writeFileSync(path.join(this.app.path, 'node_modules', addon, 'package.json'), JSON.stringify(addon_pkg, null, 2))
									pkg.dependencies = pkg.dependencies || {}
									pkg.dependencies[addon] = addon_pkg.version ? "^" + addon_pkg.version : "latest"
								} catch (e) {
									console.error('while rewriting', e)
								}
								accept()
							})
						}))
					}
				}
				return p.then(() => {
					fse.removeSync(path.join(this.app.path, 'addons'))
				})
			}
		}).then(() => {
			let modelsPath = path.join(this.app.path, 'server', 'models')
			let modelQueries = {}
			let models = {}
			if (fs.existsSync(path.join(modelsPath, 'queries'))) {
				let queries = fs.readdirSync(path.join(modelsPath, 'queries'))
				for (let query of queries) {
					let matches = query.match(/^([^.]+)\.(.+)\.js$/)
					if ( ! matches) {
						matches = query.match(/^(.+)\.js$/)
						if ( ! matches) {
							continue
						}
						matches[2] = matches[1]
						matches[1] = 'default'
					}
					let content = fs.readFileSync(path.join(modelsPath, 'queries', query)).toString()
					content = content.replace(/require\((['"])\.\./g, 'require($1../..)').replace(/^(.+)$/mg, '\t\t$1')
					modelQueries['queries/' + query] = {
						model: matches[1].replace(/^[a-zA-Z]/, v => v.toUpperCase()),
						action: this.formatName(matches[2]),
						content: content
					}
					models[matches[1]] = models[matches[1]] || []
					models[matches[1]].push(modelQueries['queries/' + query])
				}
			}
			for (let name in models) {
				let modelName = name.replace(/^[a-zA-Z]/, v => v.toUpperCase())
				let code = `class ${modelName}Model {\n`
				code += "\tconstructor(app, model) {\n"
				code += "\t\tthis.app = app;\n"
				code += "\t\tthis.model = model;\n"
				code += "\t}\n\n"
				for (let query of models[name]) {
					code += `\t${query.action}(params) {\n\t\tlet module={};\n`
					code += query.content
					code += "\n\t\treturn module.exports(this.model, params, this.app);\n\t}\n"
				}
				code += `}\nmodule.exports = ${modelName}Model;\n`
				fs.writeFileSync(path.join(modelsPath, 'queries', name.toLowerCase() + '.js'), code)
			}
			let files = fs.readdirSync(modelsPath)
			for (let file of files) {
				let file_path = path.resolve(modelsPath, file)
				if ( ! fs.lstatSync(file_path).isDirectory()) {
					let content = fs.readFileSync(file_path).toString()
					let entity
					try {
						entity = JSON.parse(content)
					} catch (e) {
						entity = {}
					}
					let matches = file.match(/^(.*)\.json/)
					if (matches) {
						entity.name = matches[1]
						if (entity.queries) {
							for (let query of entity.queries) {
								if (query.opts && query.opts.file) {
									let modelQuery = modelQueries[query.opts.file.replace('\\', '/').replace(/^entities\//, '') + '.js']
									if (modelQuery) {
										if (query.opts.model != entity.name) {
											query.opts.model = modelQuery.model.toLowerCase()
										}
										query.opts.action = modelQuery.action
										delete query.opts.file
										delete query.opts.ext
									}
								}
							}
						}
						fs.writeFileSync(file_path, JSON.stringify(entity, null, '\t'))
					}
				}
			}
			for (let queryPath in modelQueries) {
				fse.removeSync(path.join(modelsPath, queryPath))
			}
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
				this.app.logger.warn('Migrated from 0.3 structure')
			}
			return this.checkMigrateServer()
		}).then(migrate => {
			if (migrate) {
				this.app.logger.warn('Migrated from 0.4 structure')
			}
		}).catch((e) => {
			this.app.logger.warn('Error during migration:', e)
			throw e
		})
	}
}