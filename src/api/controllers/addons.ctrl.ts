import { App } from "../../lib";
import { WebsocketInstance } from "../../lib/websocket";

export class AddonsController {
	constructor(private app: App, websocket: WebsocketInstance) {}

	setup(req, res) {
		this.app.addons.setConfig(req.params.pkg, req.body);
	}
}