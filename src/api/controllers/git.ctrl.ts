import { App } from '../../lib';
import { Git } from '../lib/git';
import { WebsocketInstance } from '../../lib/websocket';

export class GitController {
	client: Git;

	constructor(private app: App, websocket: WebsocketInstance) {
		this.client = new Git(this.app);
	}

	clone(req, res) {
		this.client.clone(req.body).then((data) => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err.message);
		});
	}

	load(req, res) {
		this.client.load().then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err.message);
		});
	}

	init(req, res) {
		this.client.init().then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err.message);
		});
	}

	fetch(req, res) {
		this.client.fetch(req.body && req.body.force).then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		});
	}

	getStatus(req, res) {
		this.app.watcher.disable();
		this.client.getStatusDiff(req.query.path).then(data => {
			this.app.watcher.enable();
			res.status(200).send(data);
		}).catch(err => {
			this.app.watcher.enable();
			res.status(500).send(err);
		});
	}

	stage(req, res) {
		const promise = req.body.path
			? this.client.stage(req.body.path)
			: this.client.stageAll();

		promise.then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		});
	}

	unstage(req, res) {
		const promise = req.query.path
			? this.client.unstage(req.query.path)
			: this.client.unstageAll();

		promise.then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		});
	}

	commit(req, res) {
		this.client.commit(req.body.summary, req.body.description).then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		});
	}

	pull(req, res) {
		this.client.pull(req.body.remote, req.body.branch).then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err.message);
		});
	}

	push(req, res) {
		this.client.push().then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		});
	}

	getHistory(req, res) {
		this.client.refreshHistory().then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		});
	}

	getCommit(req, res) {
		this.client.getHistoryDetail(req.params.hash).then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		});
	}

	getHistoryFileDetail(req, res) {
		this.client.getHistoryFileDetail(req.params.hash, req.query.path).then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		});
	}

	newBranch(req, res) {
		const branchName = req.body.name;
		this.client.createLocalBranch(branchName).then(
			res.status(200).send()
		).catch(err => {
			res.status(500).send(err.message);
		});
	}

	selectBranch(req, res) {
		const branchName = req.body.branchName;
		this.app.watcher.disable();
		this.client.checkout(branchName).then(() => {
			this.app.watcher.enable();
			res.status(200).send();
		}
		).catch(err => {
			this.app.watcher.enable();
			res.status(500).send(err.message);
		});
	}

	stash(req, res) {
		this.app.watcher.disable();
		this.client.stash()
		.then(() => {
			this.app.watcher.enable();
			res.status(200).send();
		})
		.catch((err) => {
			this.app.watcher.enable();
			res.status(500).send(err.message);
		});
	}

	stashPop(req, res) {
		this.app.watcher.disable();
		this.client.stashPop()
		.then((result) => {
			this.app.watcher.enable();
			res.status(200).send(result);
		})
		.catch((err) => {
			this.app.watcher.enable();
			res.status(500).send(err.message);
		});
	}

	setupRemote(req, res) {
		this.client.setupRemote(req.body)
			.then((result) => res.status(200).send(result))
			.catch(err => res.status(500).send(err.message));
	}

	// getCommitDiff(req, res) {
	// 	this.client.get().then(data => {
	// 		res.status(200).send(data);
	// 	}).catch(err => {
	// 		res.status(500).send(err);
	// 	})
	// }

	// checkout(req, res) {
	// 	this.client.checkout().then(data => {
	// 		res.status(200).send(data);
	// 	}).catch(err => {
	// 		res.status(500).send(err);
	// 	})
	// }

	// merge(req, res) {
	// 	this.client.fetch().then(data => {
	// 		res.status(200).send(data);
	// 	}).catch(err => {
	// 		res.status(500).send(err);
	// 	})
	// }
}

