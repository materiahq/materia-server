import { App } from './app'

import * as fs from 'fs'
import * as path from 'path'
import chalk from 'chalk'

import { IClientBuild } from "@materia/interfaces";
import { ConfigType } from "./config";

export enum ScriptMode {
	WATCH = <any>'watch',
	BUILD = <any>'build',
	PROD = <any>'prod'
}

export class Client {
	config:IClientBuild = {}
	pkgPath:string
	pkgScripts:string[]
	watching:boolean

	constructor(private app: App) {
		this.watching = false
	}

	load() {
		this.app.logger.log(` └─┬ Client `)
		this.config = this.app.config.get<IClientBuild>(this.app.mode, ConfigType.CLIENT);
		/*if (fs.existsSync(path.join(this.app.path, '.materia', 'client.json'))) {
			this.config = JSON.parse(fs.readFileSync(path.join(this.app.path, '.materia', 'client.json'), 'utf-8'))
		}
		const packageJson = JSON.parse(fs.readFileSync(path.join(this.app.path, 'package.json'), 'utf-8'))
		if (packageJson && packageJson.scripts) {
			if (!this.config.scripts) {
				this.config.scripts = {}
			}
			if (! this.config.scripts.build) {
				this.config.scripts.build = packageJson.scripts.build ? "build" : null;
			}
			if (! this.config.scripts.watch) {
				this.config.scripts.watch = packageJson.scripts.watch ? "watch" : null;
			}
			if (! this.config.scripts.prod) {
				this.config.scripts.prod = packageJson.scripts.prod ? "prod" : null;
			}
		}*/
		if ( ! this.config ) {
			this.config = { build: false }
			this.app.logger.log(` │ └── ${chalk.bold('No build scripts detected')}`)
		}

		if ( ! this.config.www ) {
			this.config.www = '';
		} else {
			this.app.logger.log(` │ └── Static folder ${chalk.bold('./' + this.config.www)} detected`)
		}
		if ( ! this.config.packageJsonPath) {
			this.config.packageJsonPath = '';
		} else {
			this.config.build = true;
		}
		if (this.config.packageJsonPath || this.config.build)  {
			this.app.logger.log(` │ └── ${chalk.bold('Build system detected')}`)
		}

		if ( ! this.config.scripts ) {
			this.config.scripts = {}
		} else {
			let packagePath = './package.json';
			if (this.config.packageJsonPath) {
				packagePath = `./${this.config.packageJsonPath}/package.json`;
			}
			this.app.logger.log(` │ └── Build scripts detected in ${chalk.bold(packagePath)}`)
		}

		if ( ! this.config.autoWatch ) {
			this.config.autoWatch = false
		}
		this.app.logger.log(` │ └── ${chalk.green.bold('OK')}`)
		return Promise.resolve()
	}

	hasOneScript() {
		return !!((this.hasBuildScript(ScriptMode.BUILD) || this.hasBuildScript(ScriptMode.WATCH) || this.hasBuildScript(ScriptMode.PROD)) && this.config.www)
	}

	hasBuildScript(mode?:ScriptMode, script?:string) {
		if ( ! this.config || ! this.config.www || (this.config.www && ! this.config.build && ! this.config.packageJsonPath)) {
			return false
		}
		try {
			let pkgTxt = ''
			if (fs.existsSync(path.join(this.app.path, this.config.packageJsonPath, 'package.json'))) {
				pkgTxt = fs.readFileSync(path.join(this.app.path, this.config.packageJsonPath, 'package.json'), 'utf-8')
				this.pkgPath = path.join(this.app.path, this.config.packageJsonPath)
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

	/*set(src, build, scripts, autoWatch) {
		this.config.src = src
		this.config.build = build
		// UPDATE STATIC FOLDER AT RUNTIME
		this.app.server.dynamicStatic.setPath(path.join(this.app.path, build));
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
			if ( this.config.src == 'client' && this.config.dist == 'client' && ! this.hasOneScript() ) {
				return Promise.resolve()
			}

			let res = {
				src: this.config.src,
				scripts: {}
			} as IClientConfig

			if (this.config.dist != this.config.src && this.config.dist) {
				res.dist = this.config.dist
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
	}*/
}
