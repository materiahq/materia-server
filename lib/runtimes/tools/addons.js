'use strict'

let fs = require('fs')
let cp = require('child_process')
let path = require('path')
let EventEmitter = require('events');
var remove = require('remove')

let Handlebars = require('handlebars')
let request = require('request')

class AddonsTools {
	constructor(app) {
		this.app = app
		if (this.app) {
			this.addons = this.app.infos.addons
		}

		if (this.app) {
			this._templates_dir = path.join(this.app.materia_path, "..", "templates", "addons")
		}
	}

	parse_package(name) {
		let pkg = {
			package: name,
			vop: "@"
		}
		let matches

		if (( /^[^/:#]+$/.exec(name) )) {
			pkg.name = name
		}
		else if (( matches = /^([^/:]+)\/([^/:]+)$/.exec(name) )) {
			// type @scope/name or github_user/name
			let scope = matches[1]
			pkg.name = matches[2]
			if (scope[0] == '@') {
				pkg.scope = scope
			}
			else {
				pkg.github = scope
				pkg.vop = '#'
			}
		}
		else if (( matches = /^([^@]+@[^:]+:.*)([^/]+)$/.exec(name) )) {
			// type git remote url
			pkg.git = matches[1]
			pkg.name = matches[2]
			pkg.vop = "#"
		}
		else if (( /^https?:\/\/.*$/.exec(name) )) {
			throw new Error('Cannot use http(s) links currently.')
			//pkg.url = name
			//delete pkg.name
			//delete pkg.vop
		}
		else {
			throw new Error('Could not determine package name')
		}

		let spl = pkg.name.split('@')
		if (spl.length != 2) {
			spl = pkg.name.split('#')
		}

		if (spl.length == 2) {
			pkg.name = spl[0]
			pkg.version = spl[1]
		}

		if (pkg.scope || pkg.git) {
			pkg.npm_ver = pkg.package
		}
		else if (pkg.github) {
			pkg.npm_ver = 'github:' + pkg.package
		}
		else if (pkg.version) {
			pkg.npm_ver = pkg.version
		}
		else
			pkg.npm_ver = "latest"

		return pkg
	}

	_get_registered(name) {
		let pkg = this.parse_package(name)
		let registered_pkg = null
		for (let addon in this.addons) {
			if (pkg.name == addon) {
				registered_pkg = this.parse_package(this.addons[addon])
				if ( ! pkg.version) {
					pkg = registered_pkg
				}
			}
		}
		return registered_pkg
	}

	_prepare_temp(pkg, script) {
		let content = fs.readFileSync(path.join(this._templates_dir, script + '.hbs')).toString()
		let npm_package = fs.readFileSync(path.join(this._templates_dir, 'package.json.hbs')).toString()
		let tpl_script = Handlebars.compile(content)
		let tpl_package = Handlebars.compile(npm_package)

		let temp_root = process.env['HOME'] || '/tmp'

		let infos = {
			temp_dir: path.join(temp_root, '.tmp_addon'),
			package: pkg,
			addons_dir: path.join(this.app.path, 'addons')
		}

		content = tpl_script(infos)
		npm_package = tpl_package(infos)

		try {
			fs.mkdirSync(infos.temp_dir)
		} catch (e) {}
		fs.writeFileSync(path.join(infos.temp_dir, script), content)
		fs.writeFileSync(path.join(infos.temp_dir, "package.json"), npm_package)
		fs.chmodSync(path.join(infos.temp_dir, script), "755")

		// todo: whereis bash =>
		return cp.spawn('/bin/bash', ['-c', './' + script], {cwd: infos.temp_dir})
	}

	_all(action) {
		let p = Promise.resolve()
		let out_proc = new EventEmitter()
		out_proc.stdout = new EventEmitter()
		out_proc.stderr = new EventEmitter()
		for (let addon in this.addons) {
			((addon) => {
				p = p.then(() => {
					return new Promise((accept, reject) => {
						let proc = this[action](this.addons[addon])
						proc.on('error', (err) => {
							err.addon = addon
							reject(err)
						})
						proc.stdout.on('data', (data) => { out_proc.stdout.emit('data', data) })
						proc.stderr.on('data', (data) => { out_proc.stderr.emit('data', data) })
						proc.on('close', (code) => {
							if (code == 0) {
								out_proc.emit('success', addon)
								return accept()
							}
							let err = new Error('Could not ' + action + ' addon ' + addon + ' (npm code ' + code + ')')
							err.addon = addon
							err.code = code
							reject(err)
						})
					})
				})
			})(addon)
		}
		p.then(() => {
			out_proc.emit('close', 0)
		}).catch((err, code) => {
			if (code) {
				return Promise.resolve(code)
			}
			else {
				out_proc.emit('close', err)
			}
		})
		return out_proc
	}

	install(name, opts) {
		let pkg = this.parse_package(name)
		if (opts && opts.beforeSave) {
			opts.beforeSave()
		}
		let proc = this._prepare_temp(pkg, 'install.sh')
		proc.on('close', (code) => {
			if (opts && opts.afterSave) {
				opts.afterSave()
			}
			if (code != 0) {
				return
			}
			this.addons[pkg.name] = pkg.package
			this.app.saveMateria(opts)
		})
		return proc
	}

	update(name, opts) {
		let pkg = this._get_registered(name)
		if ( ! pkg) {
			let proc = new EventEmitter()
			let parsedpkg = this.parse_package(name)
			let err = new Error('Package ' + parsedpkg.name.yellow + ' is not installed.')
			err.addon = name
			setTimeout(() => { proc.emit('error', err) })
			return proc
		}
		if (opts && opts.beforeSave) {
			opts.beforeSave()
		}
		let proc = this._prepare_temp(pkg, 'update.sh')
		proc.on('close', (code) => {
			if (opts && opts.afterSave) {
				opts.afterSave()
			}
			//if (code != 0) {
			//	return
			//}
			// this.addons[pkg.name] = pkg.package
			// this.app.saveMateria(opts)
		})
		return proc
	}

	install_all() {
		return this._all('install')
	}

	update_all() {
		return this._all('update')
	}

	remove(name, opts) {
		let pkg = this._get_registered(name)
		if ( ! pkg) {
			let err = new Error('Package ' + name.yellow + ' is not installed.')
			err.addon = name
			return Promise.reject(err)
		}
		return new Promise((accept, reject) => {
			if (opts && opts.beforeSave) {
				opts.beforeSave()
			}
			remove(path.join(this.app.path, 'addons', pkg.name), (err) => {
				if (opts && opts.afterSave) {
					opts.afterSave()
				}
				if (err) {
					reject(err)
				}
				delete this.addons[pkg.name]
				this.app.saveMateria(opts)
				accept()
			})
		})
	}

	search(query) {
		return new Promise((accept, reject) => {
			request({
				url: 'http://localhost:8085/api/addon/search',
				qs: {q: query},
				json: true
			}, (error, response, body) => {
				if (error || response.statusCode != 200)
					return reject(body || error)
				accept(body)
			})
		})
	}
}

module.exports = AddonsTools