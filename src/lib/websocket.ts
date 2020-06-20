import * as WS from 'ws';

import * as url from 'url';

import { Server as HttpServer } from 'http';

export type IWebsocketVerifyClient = (info: {origin: any, secure: any, req: any}, cb: (done: boolean) => any) => any;

export class WebsocketInstance {
	instance: WS.Server;

	constructor(verifyClient?: IWebsocketVerifyClient) {
		this.instance = new WS.Server({
			noServer: true,
			verifyClient: (info, cb) => {
				if (verifyClient) {
					return verifyClient(info, cb);
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

	constructor(private httpServer: HttpServer) {
		this.httpServer.on('upgrade', (request, socket, head) => {
			const urlParsed = url.parse(request.url);
			const pathname = urlParsed.pathname;
			if (this.servers[pathname] && this.servers[pathname].instance) {
				this.servers[pathname].instance.handleUpgrade(request, socket, head, ws => {
					this.servers[pathname].instance.emit('connection', ws, request);
				});
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
			);
		});
	}
}