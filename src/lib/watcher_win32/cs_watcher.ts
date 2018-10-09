const cp = require('child_process');
const path = require('path');
const fs = require('fs');
import { LineDecoder } from './decoder';

const changeTypeMap = ['change', 'add', 'unlink'];

export class Win32FolderWatcher {
	handle: any;
	verboseLogging: any;
	errorCallback: any;
	eventCallback: any;
	ignored: any;
	path: any;
	constructor(options) {
		this.path = options.path;
		this.ignored = options.ignored;
		this.eventCallback = options.eventCallback;
		this.errorCallback = options.errorCallback;

		this.startWatcher();
	}

	startWatcher() {
		const args = [this.path];

		if (this.verboseLogging) {
			args.push('-verbose');
		}
		let cwd = path.join(__dirname, '..', '..', '..', '..', '..');
		let pathCli = path.join('lib', 'watcher_win32', 'CodeHelper.exe');
		if (fs.existsSync(path.join(cwd, 'app.asar'))) {
			pathCli = path.join('src', pathCli);
		} else {
			pathCli = path.join(__dirname, '..', 'src', pathCli);
			cwd = null;
		}

		this.handle = cp.spawn(pathCli, args, { cwd: cwd });

		const stdoutLineDecoder = new LineDecoder();

		this.handle.stdout.on('data', data => {
			const events = [];
			stdoutLineDecoder.write(data).forEach(line => {
				const eventParts = line.split('|');
				if (eventParts.length === 2) {
					const changeType = Number(eventParts[0]);
					const absolutePath = eventParts[1];

					// File Change Event (0 Changed, 1 Created, 2 Deleted)
					if (changeType >= 0 && changeType < 3) {
						// Support ignores
						if (this.ignored) {
							const skip = this.ignored.some(ignore => {
								if (typeof ignore == 'string') {
									return ignore == absolutePath;
								} else {
									return ignore.test(absolutePath);
								}
							});
							if (skip) {
								return;
							}
						}

						// Otherwise record as event
						events.push({
							type: changeTypeMap[changeType],
							path: path.relative(this.path, absolutePath)
						});
					} else {
						// 3 Logging
					}
				}
			});

			// Trigger processing of events through the delayer to batch them up properly
			if (events.length > 0) {
				for (const event of events) {
					this.eventCallback(event.path, event.type);
				}
			}
		});

		// Errors
		this.handle.on('error', error => this.onError(error));
		this.handle.stderr.on('data', data => this.onError(data));

		// Exit
		this.handle.on('exit', (code, signal) => this.onExit(code, signal));
	}

	onError(error) {
		this.errorCallback('[FileWatcher] process error: ' + error.toString());
	}

	onExit(code, signal) {
		if (this.handle) {
			// exit while not yet being disposed is unexpected!
			this.errorCallback(
				'[FileWatcher] terminated unexpectedly (code: ' +
					code +
					', signal: ' +
					signal +
					')'
			);
			this.startWatcher(); // restart
		}
	}

	dispose() {
		if (this.handle) {
			this.handle.kill();
			this.handle = null;
		}
	}
}

export function cs_watcher(p) {
	return new Win32FolderWatcher(p);
}
