import { App } from "../../lib";
import { Git } from "../lib/git";
import { WebsocketInstance } from "../../lib/websocket";

export class GitController {
	client: Git;

	constructor(private app: App, websocket: WebsocketInstance) {
		this.client = new Git(this.app);
	}

	load(req, res) {
		this.client.load().then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		})
	}

	init(req, res) {
		this.client.init().then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		})
	}

	fetch(req, res) {
		this.client.fetch(req.body && req.body.force).then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		})
	}

	getStatus(req, res) {
		this.client.getStatusDiff(req.query.path).then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		})
	}

	stage(req, res) {
		const promise = req.params.path
			? this.client.stage(req.params.path)
			: this.client.stageAll();

		promise.then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		})
	}

	unstage(req, res) {
		const promise = req.params.path
			? this.client.unstage(req.params.path)
			: this.client.unstageAll();

		promise.then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		})
	}

	commit(req, res) {
		this.client.commit(req.body.summary, req.body.description).then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		})
	}

	pull(req, res) {
		this.client.pull(req.body.remote, req.body.branch).then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		})
	}

	push(req, res) {
		this.client.push().then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		})
	}

	getHistory(req, res) {
		this.client.refreshHistory().then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		})
	}

	getCommit(req, res) {
		this.client.getHistoryDetail(req.params.hash).then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		})
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

