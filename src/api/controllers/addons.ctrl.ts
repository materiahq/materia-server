import { App } from "../../lib";
import { WebsocketInstance } from "../../lib/websocket";

export class AddonsController {
	constructor(private app: App, websocket: WebsocketInstance) {}

	setup(req, res) {
		const pkg = req.params.owner ?
			`${req.params.owner}/${req.params.pkg}` :
			req.params.pkg;

		this.app.addons.setConfig(pkg, req.body).then(result =>
			res.status(200).json(result)
		).catch(err => res.status(500).json(err));
	}
}