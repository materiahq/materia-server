import * as chokidar from 'chokidar';
// import { cs_watcher } from './watcher_win32/cs_watcher';
import { App, AppMode } from './app';
import chalk from 'chalk';

export enum WatcherEventType {
	INIT,
	ADD,
	REMOVE,
	CHANGE,
	REFRESH_TREE,
	UNLINK
}

export interface IWatcherEvent {
	type: WatcherEventType;
	path: string;
}

// paths:
// [ 'server/**/*.json', 'server/]

export class Watcher {
	win32Watcher: any;
	chokidarWatcher: any;
	// watchersTable: any;
	watchCallback: any;
	watcherListeners: any;
	// watchersLocks: number;
	watcherState: any;

	disabled = false;

	constructor(private app: App) {
	}

	enable() {
		setTimeout(() => {
			this.disabled = false;
		}, 200)
	}

	disable() {
		this.disabled = true;
	}

	load() {
		if (this.app.mode === AppMode.DEVELOPMENT) {
			this.watch(['*.json', 'server/**/*.json'], (p, type) => {
				if ( ! this.disabled) {
					this.app.logger.log(` └── ${type}: ${p}`)
					this.app.materiaApi.websocket.broadcast({ type, path: p })
				}
			})
		}
	}

	watch(path, callback) {
		this.dispose();

		// this.watchersLocks = 0;
		this.watcherListeners = {};
		this.watchCallback = callback;

		// this.watchersTable = {};
		// this.actions = {
		// 	beforeSave: p => {
		// 		this.watchersLocks++;
		// 		if (p) {
		// 			this.watchersTable[path] = setTimeout(() => {
		// 				// lock timeout
		// 				delete this.watchersTable[path];
		// 			}, 10000);
		// 		}
		// 	},
		// 	afterSave: () => {
		// 		setTimeout(() => {
		// 			this.watchersLocks--;
		// 		}, 1000);
		// 	}
		// };

		// if (process.platform == 'win32') {
		// 	this._watchWin32(path);
		// } else {
			this._watchChokidar(path);
		// }
	}
	dispose() {
		if (this.chokidarWatcher) {
			this.chokidarWatcher.removeListener('add', this._addEvent);
			this.chokidarWatcher.removeListener('change', this._changeEvent);
			this.chokidarWatcher.removeListener('unlink', this._unlinkEvent);
			this.chokidarWatcher.close();
			this.chokidarWatcher = null;
		}

		if (this.win32Watcher) {
			this.win32Watcher.dispose();
			this.win32Watcher = null;
		}
		return Promise.resolve();
		// if (this.actions) {
		// 	this.actions.beforeSave = () => {};
		// 	this.actions.afterSave = () => {};
		// 	this.actions = null;
		// }
	}

	private _watchChokidar(watchPath) {
		const watcher = chokidar.watch(watchPath, {
			ignoreInitial: true,
			ignorePermissionErrors: true,
			followSymlinks: true,
			interval: 1000,
			binaryInterval: 1000,
			cwd: this.app.path
		});

		this.chokidarWatcher = watcher;

		if (process.platform === 'darwin' && !watcher.options.useFsEvents) {
			this.app.logger.log(` └── Watchers: ${chalk.bold.red('WARNING')}`)
			this.app.logger.error(
				new Error('Watcher is not using native fsevents library and is falling back to unefficient polling.')
			);
		} else {
			this.app.logger.log(` └── Watchers: ${chalk.bold.green('OK')}`)
		}

		watcher.on('add', this._addEvent.bind(this));
		watcher.on('addDir', this._addEvent.bind(this));
		watcher.on('change', this._changeEvent.bind(this));
		watcher.on('unlink', this._unlinkEvent.bind(this));
		watcher.on('unlinkDir', this._unlinkEvent.bind(this));
	}

	// private _watchWin32(watchPath) {
	// 	const self = this;
	// 	this.win32Watcher = cs_watcher({
	// 		path: watchPath,
	// 		ignored: [],
	// 		eventCallback: function() {
	// 			self._eventCallback.apply(self, arguments);
	// 		},
	// 		errorCallback: function() {
	// 			self._errorCallback.apply(self, arguments);
	// 		}
	// 	});
	// 	this.app.logger.log(` └── Watchers: ${chalk.bold.green('OK')}`)
	// }

	// private _errorCallback(err) {
	// 	console.error(err);
	// }

	private _eventCallback(filePath, type) {
		if (filePath == '') {
			return;
		}
		this.watchCallback(
			filePath,
			type
			// this.watchersLocks != 0 || !!this.watchersTable[filePath]
		);
		// if (this.watchersTable[filePath]) {
		// 	clearTimeout(this.watchersTable[filePath]);
		// 	delete this.watchersTable[filePath];
		// }
	}

	private _addEvent(filePath) {
		this._eventCallback(filePath, 'add');
	}

	private _changeEvent(filePath) {
		console.log('change', filePath)
		if (/.*\.sqlite/.test(filePath)) {
			return;
		}
		this._eventCallback(filePath, 'change');
	}

	private _unlinkEvent(filePath) {
		this._eventCallback(filePath, 'unlink');
	}
}
