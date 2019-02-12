import * as crypto from 'crypto';
import {
	IGitWorkingCopy,
	IGitRemote,
	IGitBranch,
	IGitHistory,
	IGitHistoryDetails,
	IGitRemoteSuccessResponse
} from '@materia/interfaces';

import * as fs from 'fs';
import { join } from 'path';

import * as git from 'simple-git/promise';
import { App } from '../../lib';

export class Git {
	client: any;

	workingCopy: IGitWorkingCopy;
	history: IGitHistory[];

	constructor(private app: App) {
		try {
			this.client = git(this.app.path);
			this.client.silent(true);
		} catch (e) { }
	}

	init() {
		return this.client.init();
	}

	load(): Promise<any> {
		return Promise.all([
			this.refreshWorkingCopy(),
			this.refreshHistory(),
			this.refreshRemotes(),
			this.refreshBranches()
		]).then(data => {
			return {
				history: data[1],
				workingCopy: data[0],
				remotes: data[2],
				branches: data[3]
			};
		});
	}

	refreshHistory(): Promise<IGitHistory[]> {
		return this.getLogs().then(logs => {
			const history = logs.all.map(log => {
				if (log.refs) {
					log.refs = log.refs
						.split(', ')
						.filter(ref => {
							return !ref.match(/\/HEAD$/);
						})
						.map(ref => {
							const refobj = { name: ref } as any;
							const head = ref.match(/^HEAD -> (.*)/);
							if (head) {
								refobj.name = head[1];
								refobj.head = true;
							}
							return refobj;
						});
				} else {
					log.refs = [];
				}
				log.date = new Date(log.date);
				log.full_date = `${log.date.getUTCMonth() +
					1}/${log.date.getUTCDate()}/${log.date.getUTCFullYear()} at ${log.date.getUTCHours()}:${
					log.date.getUTCMinutes()}:${log.date.getUTCSeconds()}`;

				log.date = `${log.date.getMonth() +
					1}/${log.date.getDate()}/${log.date.getFullYear()}`;

				log.author_email_md5 = crypto
					.createHash('md5')
					.update(log.author_email)
					.digest('hex');

				return log;
			});
			this.history = history;
			return history;
		});
	}

	refreshWorkingCopy(): Promise<IGitWorkingCopy> {
		return this.client.status().then(data => {
			this.workingCopy = data;
			return data;
		});
	}

	refreshBranches(): Promise<IGitBranch[]> {
		return this.client.raw(['branch', '-avv']).then(branchesRaw => {
			const branches = this._parseBranch(branchesRaw);

			// When 0 commit
			let firstCommit = false;
			if (branches.length == 0) {
				branches.push({
					name: 'master',
					current: true
				});
				firstCommit = true;
			}

			return {
				branches,
				firstCommit
			};
		});
	}
	_parseBranch(raw) {
		if (!raw) {
			return [];
		}
		const lines = raw.split('\n');
		const regexp = /^([* ]) ([^ ]+)[ \t]+([a-f0-9]{7}) (\[([^ :\]]*)(: (ahead|behind) ([0-9]+))?] )?(.*)$/;
		const regexpLink = /^([* ]) ([^ ]+)[ \t]+(-> ([^ ]+))$/;
		const results = [];
		lines.forEach(line => {
			const parsed = line.match(regexp);
			if (parsed) {
				const res = {
					current: parsed[1] == '*',
					name: parsed[2],
					commit: {
						hash: parsed[3],
						subject: parsed[9]
					},
					tracking: parsed[5],
					ahead: parsed[7] == 'ahead' ? parsed[8] : 0,
					behind: parsed[7] == 'behind' ? parsed[8] : 0
				};
				results.push(res);
			} else {
				const parsed2 = line.match(regexpLink);
				if (parsed2) {
					// ?
				}
			}
		});
		return results;
	}

	refreshRemotes(): Promise<IGitRemote[]> {
		return this.client
			.getRemotes(true)
			.then(remotes => remotes.filter(remote => remote.name != ''));
	}

	getStatusDiff(
		statusPath: string
	): Promise<{ before: string; after: string }> {
		if ( ! statusPath ) {
			return Promise.resolve({
				before: '',
				after: ''
			});
		}
		const status = this.workingCopy.files.find(p => p.path == statusPath);
		let content = null;
		statusPath = this._fixGitPath(statusPath);
		try {
			const size = fs.statSync(join(this.app.path, statusPath)).size;
			if (size > 1000000.0) {
				content = '// The content is too long to display...';
			} else {
				content = fs.readFileSync(
					join(this.app.path, statusPath),
					'utf8'
				);
			}
		} catch (e) { }
		if (['A', '?'].indexOf(status.index) != -1) {
			return Promise.resolve({
				before: null,
				after: content
			});
		} else {
			return this.client
				.raw(['show', `HEAD:${statusPath}`])
				.then(oldVersion => {
					if (oldVersion.length > 1000000) {
						oldVersion = '// The content is too long to display...';
					}
					return {
						before: oldVersion,
						after: content
					};
				});
		}
	}

	getHistoryDetail(
		hash: string
	): Promise<IGitHistoryDetails> {
		const log = this.history.find(h => h.hash == hash);
		return this.getCommit(log.hash).then(details => {
			const t = details.message.split('\n');
			details.summary = t[0];
			t.shift();
			if (t[0] == '') {
				t.shift();
			}
			details.description = t.join('\n');

			details.changes = details.changes.map((change, i) => {
				return {
					index: change[0],
					path: change.slice(1).join(' ')
				};
			});
			return details;
		});
	}

	getHistoryFileDetail(hash, filepath) {
		const log = this.history.find(h => h.hash == hash);
		const tmp = log.parents.split(' ');
		const parentCommit = tmp[tmp.length - 1];
		return this.getCommit(hash).then(details => {
			const promises = [];
			let p: Promise<any> = Promise.resolve();
			details.changes.forEach(change => {
				if (change.slice(1).join(' ') === filepath) {
					const errCallback = e => {
						return null;
					};
					if ('A' == change[0]) {
						promises.push(
							this.client
								.raw(['show', `${hash}:${filepath}`])
								.catch(errCallback)
						);
						promises.push(Promise.resolve(''));
					} else if ('D' == change[0]) {
						promises.push(Promise.resolve(''));
						promises.push(
							this.client
								.raw(['show', `${parentCommit}:${filepath}`])
								.catch(errCallback)
						);
					} else {
						promises.push(
							this.client
								.raw(['show', `${hash}:${filepath}`])
								.catch(errCallback)
						);
						promises.push(
							this.client
								.raw(['show', `${parentCommit}:${filepath}`])
								.catch(errCallback)
						);
					}
				}
			});
			p = Promise.all(promises);
			return p.then(data => {
				let change = { original: '', modified: '' };
				if (data) {
					change = {
						original: data[1],
						modified: data[0]
					};
				}
				return change;
			});
		});
	}

	private getCommit(hash): Promise<any> {
		return this.client
			.show(['--pretty=%w(0)%B%n<~diffs~>', '--name-status', hash])
			.then(data => {
				const result = data.split('<~diffs~>');
				const changes = result[1]
					.trim()
					.split(/[\r\n]/)
					.map(line => line.split(/[ \t]/));
				return {
					message: result[0].trim(),
					changes: changes
				};
			});
	}

	stage(statusPath: string): Promise<IGitWorkingCopy> {
		const status = this.workingCopy.files.find(s => s.path == statusPath);
		let res;
		status.path = this._fixGitPath(status.path);
		if (status.index == 'D') {
			res = this.client.rmKeepLocal([status.path]);
		}
		res = this.client.add([status.path]);
		return res.then(() => this.refreshWorkingCopy());
	}

	unstage(statusPath: string): Promise<IGitWorkingCopy> {
		const status = this.workingCopy.files.find(s => s.path == statusPath);
		status.path = this._fixGitPath(status.path);
		return this.client
			.reset(['HEAD', status.path])
			.catch(e => {
				if (
					e &&
					e.message &&
					e.message.match(
						/ambiguous argument 'HEAD': unknown revision/
					)
				) {
					return this.client.reset([status.path]); // no HEAD yet
				}
				return Promise.reject(e);
			})
			.then(() => this.refreshWorkingCopy());
	}

	stageAll(): Promise<IGitWorkingCopy> {
		return this.client.add(['-A']).then(() => this.refreshWorkingCopy());
	}

	unstageAll(): Promise<IGitWorkingCopy> {
		return this.client.reset(['.']).then(() => this.refreshWorkingCopy());
	}

	private refreshRemoteData(): Promise<IGitRemoteSuccessResponse> {
		return Promise.all([
			this.refreshWorkingCopy(),
			this.refreshHistory()
		]).then(res => {
			return {
				workingCopy: res[0],
				history: res[1]
			};
		});
	}

	fetch(
		force?: boolean,
		gitState?: any
	): Promise<IGitRemoteSuccessResponse> {
		// if ( ! force && gitState.lastFetch && new Date().getTime() - gitState.lastFetch.getTime() < 10000) {
		// 	return Observable.of(null);
		// }

		// if (gitState && gitState.noRemote) {
		// 	throw Observable.throw(new Error("No remote"));
		// }
		return this.client
			.raw(['fetch'])
			.then(this.refreshRemoteData.bind(this));
	}

	commit(
		summary: string,
		description?: string
	): Promise<IGitRemoteSuccessResponse> {
		let message = summary;
		if (description) {
			message += '\n\n' + description;
		}
		return this.client
			.commit(message)
			.then(data =>
				Promise.all([
					this.refreshWorkingCopy(),
					this.refreshHistory()
				])
			)
			.then(res => {
				return {
					workingCopy: res[0],
					history: res[1]
				};
			});
	}

	pull(
		remote?: string,
		branch?: string
	): Promise<IGitRemoteSuccessResponse> {
		return this.client
			.pull(remote, branch)
			.then(this.refreshRemoteData.bind(this));
	}

	push(): Promise<IGitRemoteSuccessResponse> {
		return this.client.push().then(this.refreshRemoteData.bind(this));
	}

	publish(
		remote: string,
		branch: string
	): Promise<IGitRemoteSuccessResponse> {
		return this.client
			.push(['-u', remote, branch])
			.then(this.refreshRemoteData.bind(this));
	}

	copyCheckout() { }

	setupRemote(config: IGitRemote): Promise<IGitRemote[]> {
		return this.client
			.addRemote(config.name, config.url)
			.then(() => this.refreshRemotes());
	}

	private getLogs() {
		const args = {
			format: {
				hash: '%H',
				parents: '%P',
				date: '%ai',
				message: '%s',
				refs: '%D',
				author_name: '%aN',
				author_email: '%ae'
			},
			splitter: '<~spt~>',
			'--branches': null,
			'--remotes': null,
			'--tags': null
		};
		return this.client.log(args).catch(e => {
			if (
				e &&
				e.message &&
				e.message.match(
					/your current branch '.*?' does not have any commits yet/
				)
			) {
				return Promise.resolve({ all: [] });
			}
			throw e;
		});
	}

	createLocalBranch(branchName) {
		return this.client.checkoutLocalBranch(branchName);
	}

	checkout(arg) {
		if (arg.split('remotes/origin/').length - 1) {
			arg = arg.split('remotes/origin/')[1];
		}
		return this.client.checkout(arg);
	}

	stash() {
		return this.client.stash();
	}

	stashPop() {
		return this.client.stash(['pop']);
	}

	private _fixGitPath(filePath): string {
		if (filePath.substr(0, 1) == '"') {
			filePath = filePath.substr(1);
		}
		if (filePath.substr(filePath.length - 1, 1) == '"') {
			filePath = filePath.substr(0, filePath.length - 1);
		}
		return filePath;
	}
}
