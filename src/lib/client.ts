import App from './app'

import * as fs from 'fs'
import * as path from 'path'

export interface IClientConfig {
	src?:string
	build?: string
	server?: {
		port: number
	}
}

export class Client {
	config:IClientConfig

	constructor(private app: App) {

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

		this.config.src = path.join(this.app.path, this.config.src)
		this.config.build = path.join(this.app.path, this.config.build)

		return Promise.resolve()
	}
}
