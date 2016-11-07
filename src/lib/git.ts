import * as Path from 'path'

import App, { IApplyOptions } from './app'

import { EventEmitter } from 'events'

import * as mkdirp from 'mkdirp'

const fsextra = require('fs-extra')

const git = require('simple-git/promise')

export default class Git extends EventEmitter {
	repo: any

	constructor(private app: App) {
		super()
	}

	load():Promise<any> {
		this.repo = git(this.app.path)
		this.repo.silent(true)
		this.repo.outputHandler((command, stdout, stderr) => {
			stdout.on('data', (data) => {
				this.emit('stdout', data.toString(), command)
			})
			stderr.on('data', (data) => {
				this.emit('stderr', data.toString(), command)
			})
		})
		return Promise.resolve(this.repo)
	}

	init():Promise<any> {
		return this.repo.init()
	}

	status():Promise<number> {
		return this.repo.status()
	}

	stage(path:string, status?):Promise<any> {
		if (status && status.index == 'D') {
			return this.repo.rmKeepLocal([path])
		}
		return this.repo.add([path])
	}

	unstage(path:string):Promise<any> {
		return this.repo.reset(['HEAD', path]).catch((e) => {
			if (e && e.message && e.message.match(/ambiguous argument 'HEAD': unknown revision/)) {
				return this.repo.reset([path]) // no HEAD yet
			}
			throw e
		})
	}

	toggleStaging(status):Promise<any> {
		if (status.working_dir == ' ') {
			return this.unstage(status.path)
		}
		return this.stage(status.path)
	}

	logs(options?:{branch?:string}):Promise<any> {
		options = options || {}
		let args = {
			format: {
				'hash': '%H',
				'parents': '%P',
				'date': '%ai',
				'message': '%s',
				'refs': '%D',
				'author_name': '%aN',
				'author_email': '%ae'
			},
			splitter: '<~spt~>'
		}
		if (options.branch) {
			args[options.branch] = null
		} else {
			args['--branches'] = null,
			args['--remotes'] = null,
			args['--tags'] = null
		}
		return this.repo.log(args).then(logs => logs.all).catch((e) => {
			if (e && e.message && e.message.match(/your current branch '.*?' does not have any commits yet/)) {
				return Promise.resolve([])
			}
			throw e
		})
	}

	branches(opts?:{all:boolean}):Promise<any> {
		if (opts && opts.all)
			return this.repo.branch()
		else
			return this.repo.branchLocal()
	}

	remotes():Promise<any> {
		return this.repo.getRemotes().then(remotes => {
			return remotes.filter(remote => remote.name)
		})
	}

	getCommit(hash:string):Promise<any> {
		return this.repo.show(['--pretty=%w(0)%B%n<~diffs~>', '--name-status', hash]).then(data => {
			let result = data.split("<~diffs~>")
			let changes = result[1].trim().split(/[\r\n]/).map(line => line.split(/[ \t]/))
			return {
				message: result[0].trim(),
				changes: changes
			}
		})
	}

	commit(message:string):Promise<any> {
		return this.repo.commit(message)
	}

	setUpstream(branch:string, upstream:string):Promise<any> {
		return this.repo.branch(['--set-upstream-to=' + upstream, branch])
	}

	sync(options:{remote:string, branch:string, set_tracking?:boolean}, applyOptions?:IApplyOptions):Promise<any> {
		// stash && pull && stash pop && push; stops (and stash pop if needed) where if fails.
		let stashed
		applyOptions = applyOptions || {}
		if (applyOptions.beforeSave)
			applyOptions.beforeSave()
		return this.repo.branchLocal().then((data) => {
			return this.repo.stash()
		}).then((data) => {
			stashed = ! data.match(/No local changes to save/)
			let p
			if (options.set_tracking) {
				p = this.repo.pull(options.remote, options.branch)
			} else {
				p = this.repo.pull()
			}
			return p.catch((e) => {
				if (options.set_tracking && e && e.message && e.message.match(/Couldn't find remote ref/)) {
					return Promise.resolve()
				}
				if (stashed) {
					return this.repo.stash(['pop']).then(() => {
						throw e
					})
				}
				throw e
			})
		}).then((data) => {
			if (stashed)
				return this.repo.stash(['pop'])
			else
				return Promise.resolve()
		}).then((data) => {
			if (options.set_tracking) {
				return this.repo.push(['-u', options.remote, options.branch])
			} else {
				return this.repo.push()
			}
		}).then((data) => {
			if (applyOptions.afterSave)
				applyOptions.afterSave()
			return data
		}).catch((e) => {
			if (applyOptions.afterSave)
				applyOptions.afterSave()
			throw e
		})
	}

	addRemote(name:string, url:string):Promise<any> {
		return this.repo.addRemote(name, url)
	}

	addBranch(name:string):Promise<any> {
		return this.repo.checkoutLocalBranch(name)
	}

	checkout(name:string, applyOptions?:IApplyOptions):Promise<any> {
		applyOptions = applyOptions || {}
		if (applyOptions.beforeSave)
			applyOptions.beforeSave()
		return this.repo.checkout(name).then(() => {
			if (applyOptions.afterSave)
				applyOptions.afterSave()
		}).catch((e) => {
			if (applyOptions.afterSave)
				applyOptions.afterSave()
			throw e
		})
	}

	copyCheckout(options:{path:string, to:string, remote:string, branch:string}, applyOptions?:IApplyOptions):Promise<any> {
		applyOptions = applyOptions || {}
		if (applyOptions.beforeSave)
			applyOptions.beforeSave()

		let repoCopy
		let _from = Path.resolve(options.path, '.git')
		let to = Path.resolve(options.to, '.git')
		return new Promise((accept, reject) => {
			mkdirp(options.to, (err) => {
				if (err) {
					return reject(err)
				}
				accept()
			})
		}).then(() => {
			return new Promise((accept, reject) => {
				fsextra.copy(_from, to, (err) => {
					if (err) {
						return reject(err)
					}
					accept()
				})
			})
		}).then(() => {
			repoCopy = git(options.to)
			repoCopy.silent(true)
			return repoCopy.fetch(options.remote, options.branch)
		}).then(() => {
			return repoCopy.reset(["--hard", `${options.remote}/${options.branch}`])
		}).then(() => {
			if (applyOptions.afterSave)
				applyOptions.afterSave()
		}).catch((e) => {
			if (applyOptions.afterSave)
				applyOptions.afterSave()
			throw e
		})
	}
}