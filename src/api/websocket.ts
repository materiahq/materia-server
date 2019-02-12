import { Server as WebsocketServer } from 'ws';
import { createServer } from 'http';

import { App } from '../lib';

const server = createServer();

export class Websocket {
	ws: WebsocketServer;

	constructor(private app: App) {
		this.ws = new WebsocketServer({
			server: server
		});

		server.on('request', this.app.server.expressApp);
	}
}