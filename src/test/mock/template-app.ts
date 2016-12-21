import * as fs from 'fs'
import * as path from 'path'

import * as fse from 'fs-extra'
import * as request from 'request'

import App, { AppMode } from '../../lib/app'
import { ConfigType } from '../../lib/config'

export class TemplateApp {
	private name:string
	private request:request.RequestAPI<request.Request, request.CoreOptions, request.RequiredUriUrl>

	constructor(name) {
		this.name = name
	}

	createInstance():App {
		let app_path = fs.mkdtempSync((process.env.TMPDIR || '/tmp/') + 'materia-test-')
		fse.copySync(path.join(__dirname, '..', '..', '..', 'src', 'test', 'apps', this.name), app_path, { clobber:true, recursive:true })

		this.request = request.defaults({
			json: true
		})

		let app = new App(app_path, {logRequests:false})

		app.config.set({
			"host": "localhost",
			"port": 8798
		}, AppMode.DEVELOPMENT, ConfigType.WEB)

		app.config.set({
			"type": "sqlite"
		}, AppMode.DEVELOPMENT, ConfigType.DATABASE )

		app.logger.setConsole({
			log: function() {},
			warn: function() {},
			error: function() {}
		})
		return app
	}

	private promisifyRequest(method, url, args) {
		args = args.map(arg => arg)
		args.unshift("http://localhost:8798" + url)
		return new Promise((accept, reject) => {
			args.push((err, httpResponse, body) => {
				if (err) {
					return reject(err)
				}
				if (httpResponse.statusCode != 200) {
					return reject(new Error(JSON.stringify(body)))
				}
				return accept(body)
			})
			this.request[method].apply(this.request, args)
		})
	}

	get(url, ...args) {
		return this.promisifyRequest('get', url, args)
	}
	post(url, ...args) {
		return this.promisifyRequest('post', url, args)
	}
	put(url, ...args) {
		return this.promisifyRequest('put', url, args)
	}
	del(url, ...args) {
		return this.promisifyRequest('del', url, args)
	}

}