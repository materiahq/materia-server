import { App } from "../../lib";
import { WebsocketInstance } from "../../lib/websocket";
import * as fs from 'fs';

export class AddonsController {
	constructor(private app: App, websocket: WebsocketInstance) {}

	getConfig(req, res) {
		let pkg = req.params.pkg;
		if (req.params[0]) {
			pkg += req.params[0];
		}
		if (! pkg || ! this.app.addons.get(pkg)) {
			res.status(404).send();
		} else {
			res.status(200).send(this.app.addons.addonsConfig[pkg]);
		}
	}

	setup(req, res) {
		this.app.watcher.disable();
		const pkg = this.getPkgFromRequest(req);
		if (! pkg || ! this.app.addons.get(pkg)) {
			res.status(404).send();
		} else {
			this.app.addons.setConfig(pkg, req.body).then(result => {
				this.app.watcher.enable();
				res.status(200).json(result)
			}).catch(err => {
				this.app.watcher.enable();
				res.status(500).json(err)
			});
		}
	}

	enable(req, res) {
		const pkg = this.getPkgFromRequest(req);
		if (! pkg || ! this.app.addons.get(pkg)) {
			res.status(404).send();
		} else {
			this.app.addons.get(pkg).enable().then(() =>
				res.status(200).send()
			).catch(e => res.status(500).json(e));
		}
	}

	disable(req, res) {
		const pkg = this.getPkgFromRequest(req);
		if (! pkg || ! this.app.addons.get(pkg)) {
			res.status(404).send();
		} else {
			this.app.addons.get(pkg).disable().then(() =>
				res.status(200).send()
			).catch(e => res.status(500).json(e));
		}
	}

	bundle(req, res) {
		const pkg = this.getPkgFromRequest(req);
		if (! pkg || ! this.app.addons.get(pkg)) {
			res.status(404).send();
		} else {
			const bundle = fs.readFileSync(this.app.addons.get(pkg).getBundlePath());
			res.status(200).send( bundle )
		}
	}
	private getPkgFromRequest(req) {
		return req.params.owner
			? `${req.params.owner}/${req.params.pkg}`
			: req.params.pkg;
	}
}