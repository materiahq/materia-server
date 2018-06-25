import * as WS from 'ws';

import { App } from '../lib';
import * as url from 'url';

export type IWebsocketVerifyClient = (info: {origin: any, secure: any, req: any}, cb: (done: boolean) => any) => any;

export interface IWebsocketMessage {
	channel: string,
	data: any
}
export class WebsocketInstance {
	instance: WS.Server;

	constructor(verifyClient?: IWebsocketVerifyClient) {
		this.instance = new WS.Server({
			noServer: true,
			verifyClient: (info, cb) => {
				if (verifyClient) {
					return verifyClient(info, cb)
				} else {
					return cb(true);
				}
			}
		});
	}

	broadcast(data) {
		return this.instance
			.clients
			.forEach(client => {
				if (client.readyState == WS.OPEN) {
					client.send(JSON.stringify(data, null, 2));
				}
			});
	}
}

export class WebsocketServers {
	servers: {[path: string]: WebsocketInstance} = {};

	constructor(private app: App) {
		this.app.server.server.on('upgrade', (request, socket, head) => {
			const urlParsed = url.parse(request.url);
			const pathname = urlParsed.pathname;
			if (this.servers[pathname] && this.servers[pathname].instance) {

				this.servers[pathname].instance.close()
				this.servers[pathname].instance.handleUpgrade(request, socket, head, ws => {
					this.servers[pathname].instance.emit('connection', ws)
				})
			}
		});
	}

	get(endpoint: string) {
		return this.servers[endpoint];
	}

	register(endpoint: string, verifyClient?: IWebsocketVerifyClient): WebsocketInstance {
		this.servers[endpoint] = new WebsocketInstance(verifyClient);
		return this.servers[endpoint];
	}

	close() {
		Object.keys(this.servers).forEach(path => {
			this.servers[path].instance.clients.forEach(client =>
				client.terminate()
			)
		})
	}
}