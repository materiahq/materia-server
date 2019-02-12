import { App, IApplyOptions } from './app';
import { IAddon } from '@materia/interfaces';
import { IAction, IActionFilter } from '@materia/interfaces';

import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';

export class Actions {
	actions: IAction[];
	constructor(private app: App) {
		this.actions = [];
	}

	load(addon?: IAddon) {
		const basePath = addon ? addon.path : this.app.path;
		const opts: IApplyOptions = {
			save: false
		};
		if (addon) {
			opts.fromAddon = addon;
		}
		let content;
		try {
			content = fs.readFileSync(
				path.join(basePath, 'server', 'actions.json')
			);
		} catch (e) {
			return Promise.resolve();
		}

		try {
			let actions: IAction[] = JSON.parse(content.toString());
			if (addon) {
				actions = actions.map(action => {
					return Object.assign({}, action, {
						fromAddon: addon.package
					});
				});
			}
			if (actions.length > 0) {
				if (addon) {
					this.app.logger.log(` │ └─┬ ${addon.package}`);
				} else {
					this.app.logger.log(` │ └─┬ Application`);
				}
			}

			actions.forEach(action => {
				try {
					if (action.type && action.id) {
						this.app.logger.log(
							` │ │ └── ${chalk.bold(action.type)} ${action.filter && action.filter.entity ||
								action.filter && action.filter.method}.${chalk.bold(
								action.filter && action.filter.query || action.filter && '/api' + action.filter.url
							)} => ${action.action.entity}.${chalk.bold(action.action.query)}`
						);
						this.register(action, opts);
					} else {
						throw new Error('Missing required information in action.');
					}
				} catch (e) {
					this.app.logger.warn(
						`┬┴─┴─┴   ${chalk.bold.yellow(
							'Skipped'
						)} due to the following error`
					);
					this.app.logger.warn(e);
				}
			});
		} catch (e) {
			if (e.code != 'ENOENT') {
				this.app.logger.error(' │ │ └── Error loading actions');
				this.app.logger.error(e.stack);
			} else {
				return Promise.reject(e);
			}
		}
		return Promise.resolve();
	}

	findAll(filter?: IActionFilter) {
		return this.actions
			.filter(action => action.id && action.type)
			.filter(action => {
				if (filter) {
					return ((!action.filter.entity ||
						action.filter.entity == filter.entity) &&
						(!action.filter.query ||
							action.filter.query == filter.query) &&
						(!action.filter.method ||
							action.filter.method == filter.method) &&
						(!action.filter.url || action.filter.url == filter.url)
					);
				} else {
					return true;
				}
			});
	}

	get(id) {
		return this.actions.find(action => action.id == id);
	}

	register(action: IAction, opts?: IApplyOptions) {
		this.remove(action.id);
		this.actions.push(action);
		if (opts && opts.save && ! action.fromAddon) {
			this.save();
		}
	}

	remove(id, opts?: IApplyOptions) {
		const index = this.actions.findIndex(a => a.id == id);
		if (index > -1 && ! this.actions[index].fromAddon) {
			this.actions.splice(index, 1);
			if (opts && opts.save) {
				this.save();
			}
			return true;
		}
		return false;
	}

	save() {
		fs.writeFileSync(
			path.join(this.app.path, 'server', 'actions.json'),
			JSON.stringify(this.toJson(), null, '\t')
		);
	}

	toJson() {
		return this.actions.filter(action => !action.fromAddon && action.id && action.type && action.action);
	}

	handle(type: string, filter: IActionFilter, context: any, success: boolean) {
		const promises = [];
		this.actions
			.filter(
				action =>
					action.type == type &&
					((!action.filter.entity ||
						action.filter.entity == filter.entity) &&
						(!action.filter.query ||
							action.filter.query == filter.query) &&
						(!action.filter.method ||
							action.filter.method == filter.method) &&
						(!action.filter.url || action.filter.url == filter.url) &&
						(action.filter.onlySuccess === false || success) &&
						(!action.filter.onlyError ||
							(action.filter.onlyError && !success)))
			)
			.forEach(action => {
				const e = this.app.entities.get(action.action.entity);
				if (!e) {
					this.app.logger.warn(
						new Error(
							`Entity ${
								action.action.entity
							} does not exists. Skipping action`
						)
					);
				} else {
					const params = this.resolveParams(action.action.params, context);
					this.app.logger.log(`Action running ${action.action.entity}.${action.action.query}: ${JSON.stringify(params)}`);
					const q = e.getQuery(action.action.query);
					const promiseQuery = q.run(params);
					if (action.wait) {
						promises.push(promiseQuery);
					}
				}
			});
			return Promise.all(promises);
	}

	private resolveParams(params, context) {
		const paramsResolved: any = {};
		Object.keys(params).forEach(param => {
			let paramResolved = params[param];
			Object.keys(context).forEach(contextKey => {
				if (paramResolved.indexOf(`{{${contextKey}}}`) >= 0) {
					paramResolved = paramResolved.replace(
						`{{${contextKey}}}`,
						context[contextKey]
					);
				}
			});

			paramsResolved[param] = paramResolved;
		});
		return paramsResolved;
	}
}
