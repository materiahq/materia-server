import App from './app'

import * as fs from 'fs'
import * as path from 'path'

export interface IClientConfig {
	src?:string
	build?: string
	buildScript?: string
}

export class Client {
	config:IClientConfig
	pkgPath:string
	watching:boolean

	constructor(private app: App) {
		this.watching = false
	}

	load() {
		if (fs.existsSync(path.join(this.app.path, '.materia', 'client.json'))) {
			this.config = JSON.parse(fs.readFileSync(path.join(this.app.path, '.materia', 'client.json'), 'utf-8'))
		}

		if ( ! this.config ) {
			this.config = {}
		}
		if ( ! this.config.build ) {
			this.config.build = 'web'
		}
		if ( ! this.config.src ) {
			this.config.src = this.config.build
		}
		if ( ! this.config.buildScript ) {
			this.config.buildScript = 'watch'
		}

		this.config.src = path.join(this.app.path, this.config.src)
		this.config.build = path.join(this.app.path, this.config.build)

		return Promise.resolve()
	}

	hasBuildScript(script?:string) {
		if ( ! this.config || ! this.config.src) {
			return false
		}
		try {
			let pkgTxt = ''
			if (fs.existsSync(path.join(this.config.src, 'package.json'))) {
				pkgTxt = fs.readFileSync(path.join(this.config.src, 'package.json'), 'utf-8')
				this.pkgPath = this.config.src
			}
			else if (fs.existsSync(path.join(this.app.path, 'package.json'))) {
				pkgTxt = fs.readFileSync(path.join(this.app.path, 'package.json'), 'utf-8')
				this.pkgPath = this.app.path
			}
			else {
				return false
			}
			let pkg = JSON.parse(pkgTxt)

			let scriptToRun = script || this.config.buildScript

			if (pkg && pkg.scripts && pkg.scripts[scriptToRun]) {
				return true
			}
		}
		catch (e) {
		}
		return false
	}

	set(src, script, build) {
		this.config.src = path.join(this.app.path, src)
		this.config.buildScript = script || 'watch'
		this.config.build = path.join(this.app.path, build)
		this.watching = false
		return this.save()
	}

	save() {
		if ( this.config ) {
			if ( this.config.src.substr(this.app.path.length + 1) == 'web' && this.config.build.substr(this.app.path.length + 1) == 'web' && ! this.hasBuildScript() ) {
				return Promise.resolve()
			}

			let res = {
				src: this.config.src.substr(this.app.path.length + 1)
			} as IClientConfig

			if (this.config.build != this.config.src && this.config.build) {
				res.build = this.config.build.substr(this.app.path.length + 1)
			}

			if (this.config.buildScript) {
				res.buildScript = this.config.buildScript
			}

			fs.writeFileSync(path.join(this.app.path, '.materia', 'client.json'), JSON.stringify(res, null, 2), 'utf-8')
		}
		return Promise.resolve()
	}
}
