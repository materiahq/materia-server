'use strict'

import * as fs from 'fs'
import * as path from 'path'
import * as cp from 'child_process'

let Handlebars = require('handlebars')
let request = require('request')

import App, { ISaveOptions } from '../../app'

import MateriaError from '../../error'

class AddonsTools {
	addons:any

	constructor(private app:App) {
		this.addons = this.app.infos.addons
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

	remove(name, opts) {
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