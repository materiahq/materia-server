import * as fs from 'fs'
import * as path from 'path'

import * as fse from 'fs-extra'

import App from '../../lib/app'

export class TemplateApp {
	private name:string

	constructor(name) {
		this.name = name
	}

	createInstance():App {
		let app_path = fs.mkdtempSync((process.env.TMPDIR || '/tmp/') + 'materia-test-')
		fse.copySync(path.join(__dirname, '..', '..', '..', 'src', 'test', 'apps', this.name), app_path, { clobber:true, recursive:true })

		let app = new App(app_path, {logRequests: false})
		app.logger.setConsole({
			log: function() {},
			warn: function() {},
			error: function() {}
		})
		return app
	}
}