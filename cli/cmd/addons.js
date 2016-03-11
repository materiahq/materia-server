'use strict'

let App = require('../../lib/app')

module.exports = {
	matches: (args, options) => {
		return args[0] == 'addons'
	},

	exec: (args, options) => {
		let cwd = process.cwd()
		let cmd = args[1]
		let app = new App(cwd, options)
		let proc
		if (cmd == "install")
			proc = app.addonsTools.install(args[2])
		else
			return Promise.reject(new Error("Unknown command: materia addons " + cmd))
		new Promise((accept, reject) => {
			let gotStderr = false
			proc.on('error', (err) => { reject(err) })
			proc.stdout.on('data', (data) => { process.stdout.write(data) })
			proc.stderr.on('data', (data) => { process.stderr.write(data); gotStderr = true })
			proc.on('close', (code) => {
				// notice that we had some error text with gotStderr ?
				accept(code)
			})
		}).then((code) => {
			if (code == 0)
				console.log('Addon installed !')
			else {
				console.error('Failed to install addon.')
				console.error('Addon install finished with return code: ' + code.toString().yellow)
			}
		}).catch((err) => {
			if (err.stdout)
				console.error(err.stdout)
			if (err.stderr)
				console.error(err.stderr)
			console.error(err.stack)
		})
	}
}