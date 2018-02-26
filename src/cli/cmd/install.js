'use strict'

const { App } = require('../../lib/app');

let msgs = {
	install: {
		success: 'Addon %s installed !',
		failed: 'Failed to install addon %s.',
		code: 'Addon install finished with return code %d'
	}
}

function pipe_proc(proc) {
	return new Promise((accept, reject) => {
		let gotStderr = false
		proc.on('error', (err) => { reject(err) })
		if (proc.stdout && proc.stderr) {
			proc.stdout.on('data', (data) => { process.stdout.write(data) })
			proc.stderr.on('data', (data) => { process.stderr.write(data); gotStderr = true })
		}
		proc.on('close', (code) => {
			// notice that we had some error text with gotStderr ?
			accept(code)
		})
	})
}

function action_all(proc, messages) {
	proc.on('success', (addon) => {
		console.log(messages.success, addon.yellow)
	})
	pipe_proc(proc).then((code) => {
		if (code instanceof Error) {
			let err = code
			if (err.addon) {
				console.error(messages.failed, err.addon.yellow)
			}
			if (err.code) {
				console.log(messages.code, err.code)
			}
			if ( ! err.addon && ! err.code) {
				console.error(err.stack)
			}
		}
		else
			console.log('Finished !')
	}).catch((err) => {
		if (err.addon) {
			console.error(messages.failed, addon.yellow)
		}
		console.error(err.message)
	})
}

function action(addon, proc, messages) {
	return pipe_proc(proc).then((code) => {
		if (code == 0)
			console.log(messages.success, addon.yellow)
		else {
			console.error(messages.failed, addon.yellow)
			console.error(messages.code, code.toString().yellow)
		}
	}).catch((err) => {
		if ( ! err.code ) {
			if ( ! err.addon) {
				console.error(err.stack)
			}
			else {
				console.error(err.message)
			}
		}
		if (err.addon) {
			console.error(messages.failed, addon.yellow)
		}
		if (err.code) {
			console.error(messages.code, code.toString().yellow)
		}
	})
}

module.exports = {
	matches: (args, options) => {
		return args[0] == 'install'
	},

	exec: (args, options) => {
		let cwd = process.cwd()
		let npmPackage = args[1]
		let app = new App(cwd, options)

		console.log('Installing...')

		let p
		if (npmPackage) {
			p = action(npmPackage, app.addonsTools.install(npmPackage), msgs.install)
		} else {
			p = action_all(app.addonsTools.install_all(), msgs.install)
		}

		p.then(() => {
			console.log('Configuration...')

			if (npmPackage) {
				return app.addonsTools.setup(npmPackage, options).then(() => {
					console.log('Addon %s configured.', npmPackage.yellow)
				}).catch((e) => {
					console.error('Error while configuring addon %s:', npmPackage.yellow)
					console.error(e.stack)
				})
			} else {
				return app.addonsTools.setup_all(npmPackage, options).then(() => {
					console.log('Addons configured.')
				}).catch((e) => {
					console.error('Error while configuring addons:')
					console.error(e.stack)
				})
			}
		})
	}
}