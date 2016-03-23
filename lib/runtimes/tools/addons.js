'use strict'

let fs = require('fs')
let cp = require('child_process')
let path = require('path')
let Handlebars = require('handlebars')

class AddonsTools {
	constructor(app) {
		this.app = app

		this._templates_dir = path.join(this.app.materia_path, "..", "templates", "addons")
	}

	install(name, options) {
		let content = fs.readFileSync(path.join(this._templates_dir, 'install.sh.hbs')).toString()
		let tmpl = Handlebars.compile(content)

		let temp_root = process.env['HOME'] || '/tmp'

		let infos = {
			temp_dir: path.join(temp_root, '.tmp_addon'),
			temp_package: path.join(this._templates_dir, 'package.json'),
			addon_package: name,
			addons_dir: path.join(this.app.path, 'addons')
		}

		content = tmpl(infos)

		try {
			fs.mkdirSync(infos.temp_dir)
		} catch (e) {}
		fs.writeFileSync(path.join(infos.temp_dir, 'install.sh'), content)
		fs.chmodSync(path.join(infos.temp_dir, 'install.sh'), "755")

		// todo: whereis bash =>
		return cp.spawn('/bin/bash', ['-c', './install.sh'], {cwd: infos.temp_dir})
	}

	install_all(options) {
		if ( ! this.app.infos.addons)
			return Promise.resolve()
		let p = Promise.resolve()
		for (let k in this.app.infos.addons) {
			let addon
			if (this.app.infos.addons[k]) {
				if (k.indexOf('/') != -1)
					addon = k + '#' + this.app.infos.addons[k]
				else
					addon = k + '@' + this.app.infos.addons[k]
			} else {
				addon = k
			}
			;((addon) => {
				p = p.then(() => {
					return new Promise((accept, reject) => {
						let proc = this.install(addon)
						let stdout = ""
						let stderr = ""
						proc.on('error', (err) => { reject(err) })
						proc.stdout.on('data', (data) => { stdout += data.toString() })
						proc.stderr.on('data', (data) => { stderr += data.toString() })
						proc.on('close', (code) => {
							if (code == 0)
								return accept()
							let err = new Error('Could not install addon: ' + addon + ' (npm code ' + code + ')')
							err.addon = addon
							err.stdout = stdout
							err.stderr = stderr
							reject(err)
						})
					})
				})
			})(addon)
		}
		return p
	}

	update(name, options) {
	}

	remove(name, options) {
	}

	search(query) {
	}
}

module.exports = AddonsTools