import App from './app'

require('./patches/git/StatusSummary')
const git = require('simple-git/promise');

export default class Git {
	repo: any

	constructor(private app: App) {
	}

	load():Promise<any> {
		this.repo = git(this.app.path)
		return Promise.resolve(this.repo)
	}

	status():Promise<number> {
		return this.repo.status()
	}

	stage(path):Promise<any> {
		return this.repo.add(path)
	}

	unstage(path):Promise<any> {
		return this.repo.reset([path])
	}

	toggleStaging(status):Promise<any> {
		if (status.working_dir == ' ') {
			return this.unstage(status.path)
		}
		return this.stage(status.path)
	}

	logs():Promise<any> {
		return this.repo.log().then(logs => logs.all)
	}
}