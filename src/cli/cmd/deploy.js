'use strict'

const { App } = require('../../lib/app');

module.exports = {
	matches: (args, options) => {
		if (args[0] == 'deploy') {
			if (['dockerfile', 'heroku', 'aws'].indexOf(args[1]) == -1) {
				if (args[1])
					console.error('Unknown provider: ' + args[1])
				return 1
			}
			return true
		}
		return false
	},

	exec: (args, options) => {
		let cwd = process.cwd()
		let provider = args[1] || 'dockerfile'
		let app = new App(cwd, options)
		app.load().then(() => {
			console.log('Deploying ' + 'materia'.yellow + ' app ' + app.name.green + ' to ' + provider.yellow)
			return app.deploy.generate(provider, options)
		}).then(() => {
			console.log('Deploy files generated')
			console.log('Releasing ' + app.name.green + ' to ' + provider.yellow + '...')
			let proc = app.deploy.spawnRelease(provider, options)
			if (proc === null)
				return Promise.resolve()
			return new Promise((accept, reject) => {
				let gotStderr = false
				proc.on('error', (err) => { reject(err) })
				proc.stdout.on('data', (data) => { process.stdout.write(data) })
				proc.stderr.on('data', (data) => { process.stderr.write(data); gotStderr = true })
				proc.on('close', (code) => {
					// notice that we had some error text with gotStderr ?
					accept(code)
				})
			})
		}).then((code) => {
			if (code == 0)
				console.log('Deployed to ' + provider.yellow + ' !')
			else {
				console.error('Release finished with return code: ' + code.toString().yellow)
				console.error('This release might contain some errors.')
			}
		}).catch((err) => {
			console.error(err)
		})
	}
}