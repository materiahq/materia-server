import App from './app'

import * as nodegit from 'nodegit';

export default class Git {
	repo: NodeGit.Repository
	statuses: {[path:string]: NodeGit.Status}

	constructor(private app: App) {
	}

	load():Promise<NodeGit.Repository> {
		return new Promise((resolve, reject) => {
			console.log('before git open')
			nodegit.Repository.open(this.app.path).then((repo) => {
				this.repo = repo
				console.log('after git open')
				resolve(repo)
			}).catch((err) => {
				console.log('error with open', err)
				reject(err);
			})
		})
	}

	getStatus():Promise<number> {
		return this.repo.getStatus({
			flags: nodegit.Status.OPT.INCLUDE_UNTRACKED
		}).then((statusesArr) => {
			let statuses = {}
			for (let status of statusesArr) {
				statuses[status.path()] = status
			}
			this.statuses = statuses
			return this.statuses
		})
	}

	stage(path):Promise<any> {
		return this.repo.refreshIndex().then(index => {
			return index.addByPath(path).then((result) => {
				if (result)
					throw new Error('Error while adding file to index')
				return index.write()
			}).then(() => {
				this.statuses[path] = nodegit.StatusFile({
					path: path,
					status: nodegit.Status.file(this.repo, path)
				})
			})
		}).catch(e => {
			console.log(e, e.stack)
		})
	}

	unstage(path):Promise<any> {
		return this.repo.head().then((head) => {
			return head.peel(-2) // GIT_OBJ_ANY https://github.com/libgit2/libgit2/blob/master/include/git2/types.h#L68
		}).then((head) => {
			return nodegit.Reset.default(this.repo, head, path)
		}).then((result) => {
			if (result)
				throw new Error('Error while adding file to index')
			this.statuses[path] = nodegit.StatusFile({
				path: path,
				status: nodegit.Status.file(this.repo, path)
			})
		}).catch(e => {
			console.log(e, e.stack)
		})
	}

	toggleStaging(status):Promise<any> {
		console.log('before staging', status.path(), nodegit.Status.file(this.repo, status.path()));

		if (status.inIndex()) {
			console.log('unstage')
			return this.unstage(status.path())
		}
		console.log('stage', status.path())
		return this.stage(status.path())
	}
}