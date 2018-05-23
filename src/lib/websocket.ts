import * as WS from 'ws';

import { App } from '../lib';
import { OAuth } from '../api/oauth';
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
					verifyClient(info, cb);
				} else {
					cb(true);
				}
			}
		});
	}

	broadcast(data) {
		return this.instance
			.clients
			.forEach(client => {
				if (client.readyState == WS.OPEN) {
					client.send(data);
				}
			});
	}
}

export class WebsocketServers {
	server: WS.Server
	oauth: OAuth

	servers: any = {};
	listeners: Array<{channel: string, handle: (ws: WS, data: any) => any}> = []

	constructor(private app: App) {
		this.app.server.server.on('upgrade', (request, socket, head) => {
			const pathname = url.parse(request.url).pathname;
			if (this.servers[pathname]) {
				this.servers[pathname].handleUpgrade(request, socket, head, ws =>
					this.servers[pathname].emit('connection', ws)
				)
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
}