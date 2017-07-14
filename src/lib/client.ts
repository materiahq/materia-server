import App from './app'

import * as fs from 'fs'
import * as path from 'path'

export interface IClientConfig {
	src?:string
	build?:string
	buildEnabled?: boolean
	scripts?: {
		watch?:string
		build?:string
		prod?:string
	}
	autoWatch?: boolean
}

export enum ScriptMode {
	WATCH = <any>'watch',
	BUILD = <any>'build',
	PROD = <any>'prod'
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
			this.config = { buildEnabled: false }
		}

		if ( ! this.config.build ) {
			this.config.build = 'web'
		}
		if ( ! this.config.src ) {
			this.config.src = this.config.build
		}
		if ( ! this.config.scripts ) {
			this.config.scripts = {}
		}
		else {
			this.config.buildEnabled = true
		}
		/*
		if ( ! this.config.scripts.build && this.hasBuildScript(ScriptMode.BUILD, 'build') ) {
			this.config.scripts.build = 'build'
		}
		if ( ! this.config.scripts.prod && this.hasBuildScript(ScriptMode.PROD, 'prod') ) {
			this.config.scripts.prod = 'prod'
		}
		if ( ! this.config.scripts.watch && this.hasBuildScript(ScriptMode.WATCH, 'watch') ) {
			this.config.scripts.watch = 'watch'
		}*/
		if ( ! this.config.autoWatch ) {
			this.config.autoWatch = false
		}

		return Promise.resolve()
	}

	hasOneScript() {
		return !!((this.hasBuildScript(ScriptMode.BUILD) || this.hasBuildScript(ScriptMode.WATCH) || this.hasBuildScript(ScriptMode.PROD)) && this.config.build)
	}

	hasBuildScript(mode?:ScriptMode, script?:string) {
		if ( ! this.config || ! this.config.src) {
			return false
		}
		try {
			let pkgTxt = ''
			if (fs.existsSync(path.join(this.app.path, this.config.src, 'package.json'))) {
				pkgTxt = fs.readFileSync(path.join(this.app.path, this.config.src, 'package.json'), 'utf-8')
				this.pkgPath = path.join(this.app.path, this.config.src)
			}
			else if (fs.existsSync(path.join(this.app.path, 'package.json'))) {
				pkgTxt = fs.readFileSync(path.join(this.app.path, 'package.json'), 'utf-8')
				this.pkgPath = this.app.path
			}
			else {
				return false
			}
			let pkg = JSON.parse(pkgTxt)

			let scriptToRun = script
			if ( ! scriptToRun ) {
				switch (mode) {
					case ScriptMode.WATCH:
						scriptToRun = this.config.scripts.watch
						break;
					case ScriptMode.BUILD:
						scriptToRun = this.config.scripts.build
						break;
					case ScriptMode.PROD:
						scriptToRun = this.config.scripts.prod
						break;
				}
			}
			if (pkg && pkg.scripts && pkg.scripts[scriptToRun]) {
				return true
			}
		}
		catch (e) {
		}
		return false
	}

	set(src, build, scripts, autoWatch) {
		this.config.src = src
		this.config.build = build
		if ( ! this.config.scripts ) {
			this.config.scripts = {}
		}
		this.config.scripts.build = scripts.build
		this.config.scripts.watch = scripts.watch
		this.config.scripts.prod = scripts.prod

		this.config.autoWatch = autoWatch
		this.watching = false
		return this.save()
	}

	save() {
		if ( this.config ) {
			if ( this.config.src == 'web' && this.config.build == 'web' && ! this.hasOneScript() ) {
				return Promise.resolve()
			}

			let res = {
				src: this.config.src,
				scripts: {}
			} as IClientConfig

			if (this.config.build != this.config.src && this.config.build) {
				res.build = this.config.build
			}

			if (this.hasBuildScript(ScriptMode.BUILD)) {
				res.scripts.build = this.config.scripts.build
			}

			if (this.hasBuildScript(ScriptMode.PROD)) {
				res.scripts.prod = this.config.scripts.prod
			}

			if (this.hasBuildScript(ScriptMode.WATCH)) {
				res.scripts.watch = this.config.scripts.watch
			}

			if (this.config.autoWatch) {
				res.autoWatch = this.config.autoWatch
			}

			fs.writeFileSync(path.join(this.app.path, '.materia', 'client.json'), JSON.stringify(res, null, 2))
		}
		return Promise.resolve()
	}
}
