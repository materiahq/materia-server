import * as chokidar from 'chokidar';
import chalk = require('chalk');

import { App, AppMode } from './app';

export enum WatcherEventType {
	INIT,
	ADD,
	REMOVE,
	CHANGE,
	REFRESH_TREE,
	UNLINK
}

export class Watcher {
	chokidarWatcher: any;
	watchCallback: any;
	watcherListeners: any;
	watcherState: any;
	disabled = false;

	constructor(private app: App) { }

	enable(): void {
		setTimeout(() => {
			this.disabled = false;
		}, 200);
	}

	disable(): void {
		this.disabled = true;
	}

	load(): void {
		if (this.app.mode === AppMode.DEVELOPMENT) {
			this.watch(['*.json', 'server/**/*.json'], (p, type) => {
				if ( ! this.disabled) {
					this.app.logger.log(` └── ${type}: ${p}`);
					this.app.materiaApi.websocket.broadcast({ type, path: p });
				}
			});
		}
	}

	watch(path, callback): void {
		this.dispose();

		this.watcherListeners = {};
		this.watchCallback = callback;

		this._watchChokidar(path);
	}

	dispose(): Promise<void> {
		if (this.chokidarWatcher) {
			this.chokidarWatcher.removeListener('add', this._addEvent);
			this.chokidarWatcher.removeListener('change', this._changeEvent);
			this.chokidarWatcher.removeListener('unlink', this._unlinkEvent);
			this.chokidarWatcher.close();
			this.chokidarWatcher = null;
		}
		return Promise.resolve();
	}

	private _watchChokidar(watchPath): void {
		const watcher = chokidar.watch(watchPath, {
			ignoreInitial: true,
			ignorePermissionErrors: true,
			followSymlinks: true,
			interval: 1000,
			binaryInterval: 1000,
			cwd: this.app.path,
			useFsEvents: true
		});

		this.chokidarWatcher = watcher;

		// if (process.platform === 'darwin' && ! watcher.options.useFsEvents) {
		// this.app.logger.log(` └── Watchers: ${chalk.bold.red('WARNING')}`);
		// this.app.logger.error(
		// new Error('Watcher is not using native fsevents library and is falling back to unefficient polling.')
		// );
		// } else {
		this.app.logger.log(` └── Watchers: ${chalk.bold.green('OK')}`);
		// }

		watcher.on('add', this._addEvent.bind(this));
		watcher.on('addDir', this._addEvent.bind(this));
		watcher.on('change', this._changeEvent.bind(this));
		watcher.on('unlink', this._unlinkEvent.bind(this));
		watcher.on('unlinkDir', this._unlinkEvent.bind(this));
	}

	private _eventCallback(filePath, type): void {
		if (filePath == '') {
			return;
		}
		this.watchCallback(
			filePath,
			type
		);
	}

	private _addEvent(filePath): void {
		this._eventCallback(filePath, 'add');
	}

	private _changeEvent(filePath): void {
		if (/.*\.sqlite/.test(filePath)) {
			return;
		}
		this._eventCallback(filePath, 'change');
	}

	private _unlinkEvent(filePath): void {
		this._eventCallback(filePath, 'unlink');
	}
}
