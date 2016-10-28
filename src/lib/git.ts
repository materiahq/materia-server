import App from './app'

require('./patches/git/StatusSummary')
require('./patches/git/ListLogSummary')
const git = require('simple-git/promise');

export default class Git {
	repo: any

	constructor(private app: App) {
	}

	load():Promise<any> {
		this.repo = git(this.app.path)
		this.repo.silent(true)
		return Promise.resolve(this.repo)
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

	logs():Promise<any> {
		return this.repo.log({
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
		}).then(logs => logs.all).catch((e) => {
			if (e && e.message && e.message.match(/your current branch '.*?' does not have any commits yet/)) {
				return Promise.resolve([])
			}
			throw e
		})
	}

	branches(opts?:{all:boolean}):any {
		if (opts && opts.all)
			return this.repo.branch().then(branches => branches.all)
		else
			return this.repo.branchLocal().then(branches => branches.all)
	}

	remotes():any {
		return this.repo.getRemotes()
	}

	getCommit(hash:string):any {
		return this.repo.show(['--pretty=%w(0)%B%n<~diffs~>', '--name-status', hash]).then(data => {
			let result = data.split("<~diffs~>")
			let changes = result[1].trim().split(/[\r\n]/).map(line => line.split(/[ \t]/))
			return {
				message: result[0].trim(),
				changes: changes
			}
		})
	}
}