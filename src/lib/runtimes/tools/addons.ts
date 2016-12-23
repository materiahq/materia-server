'use strict'

import * as fs from 'fs'
import * as path from 'path'
import * as cp from 'child_process'
import * as readline from 'readline'

import App, { ISaveOptions } from '../../app'

import MateriaError from '../../error'

class AddonsTools {
	addons:any

	constructor(private app:App) {
	}

	install(name:string, opts: ISaveOptions):Promise<any> {
		let proc = cp.spawn('npm', ['install', name, '--save'], {
			cwd: this.app.path
		})
		if (opts && opts.beforeSave) {
			opts.beforeSave()
		}
		return new Promise((accept, reject) => {
			proc.on('close', (code) => {
				if (opts && opts.afterSave) {
					opts.afterSave()
				}
				if (code != 0) {
					return reject(new MateriaError('Failed to install addon'))
				}
				accept()
			})
		})
	}

	install_all(opts: ISaveOptions):Promise<any> {
		let proc = cp.spawn('npm', ['install'], {
			cwd: this.app.path
		})
		if (opts && opts.beforeSave) {
			opts.beforeSave()
		}
		return new Promise((accept, reject) => {
			proc.on('close', (code) => {
				if (opts && opts.afterSave) {
					opts.afterSave()
				}
				if (code != 0) {
					return reject(new MateriaError('Failed to install app'))
				}
				accept()
			})
		})
	}

	setup(name:string, opts: ISaveOptions):Promise<void> {
		return this.app.addons.setupModule((require) => {
			let setupObj
			try {
				setupObj = require(path.join(name, 'setup.json'))
				if ( ! Array.isArray(setupObj)) {
					return Promise.reject(new MateriaError(`setup.json must contain an array`))
				}
			} catch(e) {
				if (e.code != 'MODULE_NOT_FOUND') {
					return Promise.reject(new MateriaError(`Error in ${name}/setup.json`))
				}
			}
			if ( ! setupObj) {
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

	remove(name:string, opts:ISaveOptions):Promise<any> {
		let proc = cp.spawn('npm', ['uninstall', name, '--save'], {
			cwd: this.app.path
		})
		if (opts && opts.beforeSave) {
			opts.beforeSave()
		}
		return new Promise((accept, reject) => {
			proc.on('close', (code) => {
				if (opts && opts.afterSave) {
					opts.afterSave()
				}
				if (code != 0) {
					return reject(new MateriaError('Failed to uninstall addon'))
				}
				this.app.addons.unload(name)
				accept()
			})
		})
	}

	search(query) {
		/* Receive addons from npm @materia scope */
		return Promise.reject(new MateriaError('Not implemented yet', { slug: 'addons_search' }))
	}
}

module.exports = AddonsTools