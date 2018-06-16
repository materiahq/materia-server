import { App } from "../../lib";
import { WebsocketInstance } from "../../lib/websocket";

export class AddonsController {
	constructor(private app: App, websocket: WebsocketInstance) {}

	setup(req, res) {
		const pkg = this.getPkgFromRequest(req);

		this.app.addons.setConfig(pkg, req.body).then(result =>
			res.status(200).json(result)
		).catch(err => res.status(500).json(err));
	}

	enable(req, res) {
		const pkg = this.getPkgFromRequest(req);
		this.app.addons.get(pkg).enable().then(() =>
			res.status(200).send()
		).catch(e => res.status(500).json(e));
	}

	disable(req, res) {
		const pkg = this.getPkgFromRequest(req);
		this.app.addons.get(pkg).disable().then(() =>
			res.status(200).send()
		).catch(e => res.status(500).json(e));
	}

	private getPkgFromRequest(req) {
		return req.params.owner
			? `${req.params.owner}/${req.params.pkg}`
			: req.params.pkg;
	}
}