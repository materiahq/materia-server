import * as fs from 'fs'
import * as path from 'path'
import * as cp from 'child_process'
import * as readline from 'readline'

import App, { ISaveOptions } from '../../app'

import MateriaError from '../../error'
import { Dependency } from '../../dependency'

class AddonsTools {
	addons:any

	constructor(private app:App) {
	}

	private buffProc(proc:cp.ChildProcess, callback:(code:number, out:string, err:string)=>void) {
		let out = ""
		let err = ""
		proc.stdout.on('data', data => {
			out += data.toString()
		})
		proc.stderr.on('data', data => {
			err += data.toString()
		})
		proc.on('close', code => {
			callback(code, out, err)
		})
		proc.on('error', err => {
			callback(-1, "", err.message)
		})
	}

	private _postInstall(proc, opts) {
		return new Promise((accept, reject) => {
			this.buffProc(proc, (code, out, err) => {
				if (opts && opts.afterSave) {
					opts.afterSave()
				}
				if (code != 0) {
					let e = new MateriaError('Failed to install/uninstall addons')
					e.debug = err
					this.app.logger.log(' └─ Fail!')
					return reject(e)
				}
				this.app.logger.log(' └─ Success!')
				accept()
			})
		})
	}

	private pmCall(yarnParams:string[], npmParams:string[], opts: ISaveOptions) {
		return Dependency.check('yarn').then(path => {
			this.app.logger.log(' └─ Dependency: Yarn found')
			this.app.logger.log(` └─ Run: yarn ${yarnParams.join(' ')}`)
			let proc = cp.spawn(path, yarnParams, {
				cwd: this.app.path
			})
			return Promise.resolve({proc: proc, opts: opts})
		}).catch(e => {
			this.app.logger.log(' └─ Dependency: Yarn not found, fallback on NPM')
			return Dependency.check('npm').then(path => {
				this.app.logger.log(' └─ Dependency: NPM found')
				this.app.logger.log(` └─ Run: npm ${npmParams.join(' ')}`)
				let proc = cp.spawn(path, npmParams, {
					cwd: this.app.path
				})
				return Promise.resolve({proc: proc, opts: opts})
			}).catch(e => {
				this.app.logger.log(' └─ Dependency: NPM not found')
				this.app.logger.log(' └─ Fail!')
				return Promise.reject(e)
			})
		}).then(data => this._postInstall(data.proc, data.opts))
	}

	install(name:string, opts: ISaveOptions):Promise<any> {
		if (opts && opts.beforeSave) {
			opts.beforeSave()
		}
		this.app.logger.log(`(Addons) Install ${name}`)
		return this.pmCall(['add', name], ['install', name, '--save'], opts)
	}

	install_all(opts: ISaveOptions):Promise<any> {
		if (opts && opts.beforeSave) {
			opts.beforeSave()
		}
		this.app.logger.log(`(Addons) Install All`)
		return this.pmCall([], ['install'], opts);
	}

	remove(name:string, opts:ISaveOptions):Promise<any> {
		if (opts && opts.beforeSave) {
			opts.beforeSave()
		}
		this.app.logger.log(`(Addons) Uninstall ${name}`)
		return this.pmCall(['remove', name], ['uninstall', name, '--save'], opts)
	}

	setup(name:string, opts: ISaveOptions):Promise<void> {
		return this.app.addons.setupModule((require) => {
			return this.app.addons.get(name).getSetupConfig().then(setupObj => {
				if (setupObj.length == 0) {
					return Promise.resolve()
				}
				const rl = readline.createInterface({
					input: process.stdin,
					output: process.stdout
				})
				return this.app.addons.loadConfig().then((configs) => {
					let config = configs[name] = configs[name] || {}
					let p = Promise.resolve()
					for (let param of setupObj) {
						p = p.then(() => {
							let description = param.description
							let def = config[param.name] === undefined ? param.default : config[param.name]
							if (param.type == 'boolean') {
								if (def === false) {
									description += ': [y/N] '
								} else {
									description += ': [Y/n] '
									def = true
								}
							} else if (def !== undefined) {
								description += `: (${def}) `
							} else {
								description += ": "
							}

							return new Promise((accept, reject) => {
								rl.question(description, answer => {
									return accept(answer)
								})
							}).then((value:any) => {
								if (value == "") {
									value = def
								}
								else if (param.type == 'boolean') {
									value = value.toLowerCase()[0] == 'y'
								}
								else if (param.type == 'number') {
									value = parseInt(value)
								}
								else if (param.type == 'float') {
									value = parseFloat(value)
								}

								if (param.type == 'date') {
									value = new Date(value)
								}
								if (param.type == 'text') {
									value = value || ""
								}

								config[param.name] = value
							})
						})
					}

					return p.then(() => {
						return this.app.saveFile('.materia/addons.json', JSON.stringify(configs), { mkdir:true })
					}).then(() => {
						rl.close()
					}).catch(e => {
						rl.close()
						throw e
					})
				})
			})
		})
	}

	setup_all(opts: ISaveOptions):Promise<void> {
		return this.app.addons.searchInstalledAddons().then((addons) => {
			let p = Promise.resolve()
			for (let addon of addons) {
				p = p.then(() => this.setup(addon, opts))
			}
			return p
		})
	}

	search(query) {
		/* Receive addons from npm @materia scope */
		return Promise.reject(new MateriaError('Not implemented yet', { slug: 'addons_search' }))
	}
}

module.exports = AddonsTools