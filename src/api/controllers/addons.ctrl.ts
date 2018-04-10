import { App } from "../../lib";

export class AddonsController {
	constructor(private app: App) {}

	setup(req, res) {
		this.app.addons.setConfig(req.params.pkg, req.body);
	}
}