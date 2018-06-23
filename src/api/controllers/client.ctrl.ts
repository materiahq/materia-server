import { App } from '../../lib';
import { Npm } from '../lib/npm';

export class ClientController {
	npm: Npm;

	constructor(private app: App) {
		this.npm = new Npm(this.app);
	}

	private _emitMessage(message) {
		const type = "client"
		this.app.materiaApi.websocket.broadcast({ type, message: message })
	}

	private _emitError(err) {
		const type = "client:error"
		this.app.materiaApi.websocket.broadcast({ type, error: err })
	}

	private _emitSuccess(message) {
		const type = "client:success"
		this.app.materiaApi.websocket.broadcast({ type, message: message })
	}

	build(req, res) {
		res.status(200).send({});
		this._emitMessage('Launch build-script');
		this.npm.exec('run-script', ['build']).then((res) => {
			this._emitSuccess('Build success');
		}).catch(err => this._emitError(err))
	}
}