import { App, ConfigType } from '../../lib';
import { Npm } from '../lib/npm';
import { WebsocketInstance } from '../../lib/websocket';
import { IClientConfig } from '@materia/interfaces';

export class ClientController {
	npm: Npm;

	constructor(private app: App, private websocket: WebsocketInstance) {
		this.npm = new Npm(this.app);
	}

	private _parse(data) {
		let match = data.match(/([0-9]{1,2})% ([^%]+)$/)
		if (match) {
			return {
				progress: match[1],
				progressStatus: match[2]
			}
		}
		return false;
	}

	build(req, res) {
		res.status(200).send({});
		this.websocket.broadcast({
			type: 'client',
			message: 'Launch build-script'
		})
		const conf = this.app.config.get<IClientConfig>(this.app.mode, ConfigType.CLIENT)
		const script = conf.scripts && conf.scripts.build ? conf.scripts.build : 'build';
		this.npm.exec('run-script', [script], (data, error) => {
			const progress = this._parse(data);
			if (progress) {
				this.websocket.broadcast({
					type: 'client:progress',
					progress: progress.progress,
					status: progress.progressStatus
				})
			}
		}).then((res) => {
			this.websocket.broadcast({
				type: 'client:success',
				message: 'Build success'
			})
		}).catch(error => this.websocket.broadcast({
			type: 'client:error',
			error
		}))
	}
}