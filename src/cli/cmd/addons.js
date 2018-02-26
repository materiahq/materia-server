'use strict'

const { App } = require('../../lib/app');

let msgs = {
	install: {
		success: 'Addon %s installed !',
		failed: 'Failed to install addon %s.',
		code: 'Addon install finished with return code %d'
	},
	update: {
		success: 'Addon %s updated !',
		failed: 'Failed to update addon %s.',
		code: 'Addon update finished with return code %d'
	},
	remove: {
		success: 'Addon %s removed !',
		failed: 'Could not remove addon %s.'
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
	pipe_proc(proc).then((code) => {
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
		if (args[0] == 'addons') {
			if (["install", "update", "remove", "search"].indexOf(args[1]) != -1) {
				if ( ! args[2] && (args[1] == "remove" || args[1] == "search"))
					return 1
				return true
			}
			return 1
		}
		return false
	},

	exec: (args, options) => {
		let cwd = process.cwd()
		let cmd = args[1]

		if (cmd == "search") {
			let AddonsTools = require('../../lib/runtimes/tools/addons')
			let addonsTools = new AddonsTools()
			addonsTools.search(args[2]).then((results) => {
				if ( ! results.length)
					return console.log('No addon found')
				console.log("Search results:")
				console.log("")
				for (let result of results) {
					console.log('\t' + result.name.cyan + '\t' + result.description)
				}
			}).catch((err) => {
				console.error(err.message.red)
			})
			return
		}

		let app = new App(cwd, options)
		if (cmd == "install") {
			if (args[2]) {
				action(args[2], app.addonsTools.install(args[2]), msgs.install)
			} else {
				action_all(app.addonsTools.install_all(), msgs.install)
			}
		}
		else if (cmd == "update") {
			if (args[2]) {
				action(args[2], app.addonsTools.update(args[2]), msgs.update)
			} else {
				action_all(app.addonsTools.update_all(), msgs.update)
			}
		}
		else if (cmd == "remove") {
			app.addonsTools.remove(args[2]).then(() => {
				console.log(msgs.remove.success, args[2].yellow)
			}).catch((err) => {
				console.error(err.message)
				console.error(msgs.remove.failed, args[2].yellow)
			})
		}
	}
}