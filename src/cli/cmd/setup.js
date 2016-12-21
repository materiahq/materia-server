'use strict'

import App from '../../lib/app'

module.exports = {
	matches: (args, options) => {
		return args[0] == 'setup'
	},

	exec: (args, options) => {
		let cwd = process.cwd()
		let npmPackage = args[1]
		let app = new App(cwd, options)

		console.log('Configuration...')

		if (npmPackage) {
			app.addonsTools.setup(npmPackage, options).then(() => {
				console.log('Addon %s configured.', npmPackage.yellow)
			}).catch((e) => {
				console.error('Error while configuring addon %s:', npmPackage.yellow)
				console.error(e.stack)
			})
		} else {
			app.addonsTools.setup_all(npmPackage, options).then(() => {
				console.log('Addons configured.')
			}).catch((e) => {
				console.error('Error while configuring addons:')
				console.error(e.stack)
			})
		}
	}
}