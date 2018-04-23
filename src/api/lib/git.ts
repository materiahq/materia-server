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
import * as path from 'path';

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
		} catch(e) {
			console.log(e);
		}
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
		})
	}

	refreshHistory(): Promise<IGitHistory[]> {
		return this.getLogs().then(logs => {
			// console.log('#1 logs', logs)
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
			// console.log('logs:', logs)
			// if (!this.selected) {
			// 	this.select(logs[0]);
			// }
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
				// console.log('** branch', res, line)
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
		if (!statusPath) {
			return Promise.resolve({
				before: '',
				after: ''
			});
		}
		const status = this.workingCopy.files.find(p => p.path == statusPath);
		let content = null;
		try {
			content = fs.readFileSync(
				path.join(this.app.path, statusPath),
				'utf8'
			);
		} catch (e) {}
		if (['A', '?'].indexOf(status.index) != -1) {
			return Promise.resolve({
				before: null,
				after: content
			});
		} else {
			return this.client
				.show(`HEAD:${statusPath}`)
				.then(oldVersion => {
					return {
						before: oldVersion,
						after: content
					};
				})
				.catch(e => {
					console.log('error when selected status', status, e);
				})
		}
	}

	getHistoryDetail(
		hash: string
	): Promise<IGitHistoryDetails> {
		const log = this.history.find(h => h.hash == hash);
		const isLast = this.history[this.history.length - 1].hash == hash;
		return this.getCommit(log.hash).then(details => {
			const t = details.message.split('\n');
			details.summary = t[0];
			t.shift();
			if (t[0] == '') {
				t.shift();
			}
			details.description = t.join('\n');

			let p: Promise<any> = Promise.resolve();

			if (!isLast) {
				const promises = [];
				const tmp = log.parents.split(' ');
				const parentCommit = tmp[tmp.length - 1];
				details.changes.forEach(change => {
					const errCallback = e => {
						console.log(e);
						return '';
					};
					if ('A' == change[0]) {
						promises.push(
							this.client
								.show(`${log.hash}:${change[1]}`)
								.catch(errCallback)
						);
						promises.push(Promise.resolve(''));
					} else if ('D' == change[0]) {
						promises.push(Promise.resolve(''));
						promises.push(
							this.client
								.show(`${parentCommit}:${change[1]}`)
								.catch(errCallback)
						);
					} else {
						promises.push(
							this.client
								.show(`${log.hash}:${change[1]}`)
								.catch(errCallback)
						);
						promises.push(
							this.client
								.show(`${parentCommit}:${change[1]}`)
								.catch(errCallback)
						);
					}
				});
				p = Promise.all(promises);
			}

			return p.then(data => {
				if (data) {
					details.changes = details.changes.map((change, i) => {
						return {
							index: change[0],
							path: change[1],
							diff: {
								original: data[i * 2 + 1],
								modified: data[i * 2]
							}
						};
						// change.push(data[i]);
					});
				}
				return details;
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
			})
			.catch(e => console.log(`error getting commit ${hash}: ${e}`));
	}

	stage(statusPath: string): Promise<IGitWorkingCopy> {
		const status = this.workingCopy.files.find(s => s.path == statusPath);
		let res;
		if (status.index == 'D') {
			res = this.client.rmKeepLocal([status.path]);
		}
		res = this.client.add([status.path]);
		return res.then(() => this.refreshWorkingCopy())
	}

	unstage(statusPath: string): Promise<IGitWorkingCopy> {
		const status = this.workingCopy.files.find(s => s.path == statusPath);
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
					return this.client.reset([path]); // no HEAD yet
				}
				throw e;
			})
			.then(() => this.refreshWorkingCopy())
	}

	stageAll(): Promise<IGitWorkingCopy> {
		return this.client.add(['-A']).then(() => this.refreshWorkingCopy())
	}

	unstageAll(): Promise<IGitWorkingCopy> {
		return this.client.reset(['.']).then(() => this.refreshWorkingCopy())
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
			.then(this.refreshRemoteData.bind(this))
			.catch(e => {
				console.log('ERROR FETCH', e);
				throw e;
			})
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
			})
	}

	pull(
		remote?: string,
		branch?: string
	): Promise<IGitRemoteSuccessResponse> {
		return this.client
			.pull(remote, branch)
			.then(this.refreshRemoteData.bind(this))
	}

	push(): Promise<IGitRemoteSuccessResponse> {
		return this.client.push().then(this.refreshRemoteData.bind(this))
	}

	publish(
		remote: string,
		branch: string
	): Promise<IGitRemoteSuccessResponse> {
		return this.client
			.push(['-u', remote, branch])
			.then(this.refreshRemoteData.bind(this))
	}

	copyCheckout() {}

	setupRemote(config: IGitRemote): Promise<IGitRemote[]> {
		return this.client
			.addRemote(config.name, config.url)
			.then(() => this.refreshRemotes())
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
			console.log('error getting logs', e);
			throw e;
		});
	}
}
