'use strict'

let fs = require('fs')

class HistoryContext {
	constructor(history, tag) {
		this.entities_map = {}
		this.entities_rev_map = {}
		this.DiffType = history.DiffType
		this.tag = tag
		this.edit_map = {}
	}

	getEntityName(name) {
		return this.entities_map[name] || name
	}

	getEntityBaseName(name) {
		return this.entities_rev_map[name] || name
	}

	renameEntity(name, new_name, opts) {
		if (opts.not_actual !== false)
			this.entities_map[this.getEntityBaseName(name)] = new_name
		this.entities_rev_map[new_name] = this.getEntityBaseName(name)
	}

	apply(diff, opts) {
		opts = opts || {}
		if (! diff || ! diff.redo) console.log('apply fail', diff)
		if (diff.redo.type == this.DiffType.RENAME_ENTITY) {
			this.renameEntity(diff.redo.table, diff.redo.value, opts)
			this.log()
		} else if (diff.redo.type == this.DiffType.CREATE_ENTITY) {
			let edit = {}
			for (let k in diff.redo) {
				edit[k] = diff.redo[k]
			}
			edit.table = this.getEntityBaseName(edit.table)
			this.edit_map[diff.redo.type] = this.edit_map[diff.redo.type] || []
			this.edit_map[diff.redo.type].push(edit)
		}
	}

	scan(diffs) {
		this.entities_map = {}
		this.entities_rev_map = {}
		for (let diff of diffs) {
			this.apply(diff)
		}
	}

	log() {
		console.log('map ' + this.tag, this.entities_map)
		console.log('reverse ' + this.tag, this.entities_rev_map)
		console.log('edit ' + this.tag, this.edit_map)
	}
}

class History {
	constructor(app) {
		this.app = app
		this.actions = {}
		this.diff = []
		this.diff_redo = []

		this.DiffType = Object.freeze({
			// entities
			CREATE_ENTITY: 'create_entity',
			RENAME_ENTITY: 'rename_entity',
			DELETE_ENTITY: 'delete_entity',
			ADD_FIELD: 'create_field',
			CHANGE_FIELD: 'change_field',
			DELETE_FIELD: 'delete_field',
			//ADD_FK: 'add_foreign_key',
			//DELETE_FK: 'delete_foreign_key'

			// queries
			ADD_QUERY: 'add_query',
			DELETE_QUERY: 'delete_query',
			ADD_QUERY_PARAM: 'add_query_param',
			DELETE_QUERY_PARAM: 'delete_query_param',
			UPDATE_QUERY_VALUE: 'update_query_value',

			// api
			ADD_API_PARAM: 'add_api_param',
			DELETE_API_PARAM: 'delete_api_param',
			ADD_API_DATA: 'add_api_data',
			DELETE_API_DATA: 'delete_api_data',
		})

		this.context = new HistoryContext(this, 'local')
	}

	cleanStacks() {
		let diff = []
		for (let d of this.diff)
			diff.push({undo:d.undo, redo:d.redo})
		let diff_redo = []
		for (let d of this.diff_redo)
			diff_redo.push({undo:d.undo, redo:d.redo})
		this.diff = diff
		this.diff_redo = diff_redo
	}

	load() {
		try {
			let changes = fs.readFileSync(this.app.path + '/history/changes.json')
			this.diff = JSON.parse(changes.toString())
		} catch(e) {
			this.diff = []
		}
	}

	save() {
		this.cleanStacks()
		fs.existsSync(this.app.path + '/history') || fs.mkdirSync(this.app.path + '/history');
		fs.writeFileSync(this.app.path + '/history/changes.json', JSON.stringify(this.diff, null,  '\t'))
	}

	push(redo, undo) {
		this.diff.push({undo:undo, redo:redo})
		this.diff_redo = []
		this.save()
	}

	register(type, action) {
		this.actions[type] = action
	}

	undoable() {
		return this.diff.length > 0
	}

	redoable() {
		return this.diff_redo.length > 0
	}

	getUndoStack() {
		return this.diff
	}

	getRedoStack() {
		return this.diff_redo
	}

	undo(options) {
		options = options || {}
		return new Promise((accept, reject) => {
			if (this.diff.length == 0)
				return accept({})
			let actionobj = this.diff.pop()
			this.diff_redo.push(actionobj)

			console.log('undo', actionobj.undo)
			let action = this.actions[actionobj.undo.type]
			action(actionobj.undo).then(() => {
				if (options.save !== false)
					this.save()
				return accept(actionobj.undo)
			}, (err) => {
				if (options.save !== false)
					this.save()
				return reject(err)
			})
		})
	}

	redo(options, context) {
		options = options || {}
		if (this.diff_redo.length == 0)
			return Promise.resolve({})
		let actionobj = this.diff_redo.pop()
		this.diff.push(actionobj)

		let targetTable, p
		if (context && this.context) {
			if (actionobj.redo.table) {
				targetTable = this.context.getEntityName(context.getEntityBaseName(actionobj.redo.table))
			}

			context.apply(actionobj)

			if (options.resolve) {
				if (this.context.getEntityBaseName(actionobj.redo.table) == context.getEntityBaseName(actionobj.redo.table)) {
					if (actionobj.redo.type == this.DiffType.RENAME_ENTITY || actionobj.redo.type == this.DiffType.CREATE_ENTITY) {
						p = options.resolve({
							type: actionobj.redo.type,
							local: targetTable,
							remote: actionobj.redo.value
						})
					} else if (actionobj.redo.type == this.DiffType.CHANGE_FIELD
							&& actionobj.redo.name == actionobj.redo.name)
				}
			}
		}
		p = p || Promise.resolve({})
		return p.then((resolved) => {
			console.log('resolved:', resolved)
			if (context && this.context) {
				if (targetTable) {
					actionobj.redo.table = targetTable
				}
				console.log('1--')
				if (actionobj.undo.type == this.DiffType.RENAME_ENTITY) {
					actionobj.undo.value = targetTable
				}
				console.log('2--')
			}

			this.context.apply(actionobj, {not_actual: resolved.choice == 'change'})

			if (resolved.choice == 'keep' || resolved.choice == 'merge')
				return Promise.resolve({cancel:true})

			console.log('redo', actionobj.redo)
			let action = this.actions[actionobj.redo.type]
			return action(actionobj.redo)
		}).then((res) => {
			if (options.save !== false)
				this.save()
			return Promise.resolve((res && res.cancel) ? {} : actionobj.redo)
		}).catch((err) => {
			if (options.save !== false)
				this.save()
			throw err
		})
	}

	clear() {
		this.diff = []
		this.diff_redo = []
	}

	commit(hash) {
		this.cleanStacks()
		fs.existsSync(this.app.path + '/history') || fs.mkdirSync(this.app.path + '/history');
		fs.writeFileSync(this.app.path + '/history/' + hash + '.json', JSON.stringify(this.diff, null, '\t'))
		this.diff = []
		this.save()
		return Promise.resolve()
	}

	revertFile(commit) {
		let diffs
		try {
			let changes = fs.readFileSync(this.app.path + '/history/' + commit + '.json')
			diffs = JSON.parse(changes.toString())
		} catch(e) {
			return Promise.reject(e)
		}
		return this.revert(diffs)
	}

	revert(diffs) {
		let diff_redo = this.diff_redo
		let diff_undo = this.diff
		try {
			this.diff_redo = []
			this.diff = []
			if (diffs && diffs.length) {
				for (let diff of diffs) {
					this.diff.push(diff)
				}
			}
		} catch(e) {
			return Promise.reject(e)
		}

		let actions = []
		let p = Promise.resolve({})
		console.log('reverting...', this.diff)
		for (let i in this.diff) {
			p = p.then((action) => {
				if (action.type)
					actions.push(action)
				return this.undo({save: false})
			})
		}

		p = p.then((action) => {
			if (action.type)
				actions.push(action)
			this.diff_redo = diff_redo
			this.diff = diff_undo
			return Promise.resolve(actions)
		}).catch((e) => {
			console.error('FATAL: Could not revert')
			this.diff_redo = diff_redo
			this.diff = diff_undo
			throw e
		})

		return p
	}

	apply(commit, options) {
		options = options || {}
		let diff_redo = this.diff_redo
		let diff_undo = this.diff

		this.context.scan(this.diff)

		try {
			let changes = fs.readFileSync(this.app.path + '/history/' + commit + '.json')
			let diffs = JSON.parse(changes.toString())
			this.diff_redo = []
			this.diff = []
			if (diffs && diffs.length) {
				for (let diff of diffs) {
					this.diff_redo.unshift(diff)
				}
			}
		} catch(e) {
			return Promise.reject(e)
		}

		let context = new HistoryContext(this, 'remote')

		let actions = []
		let p = Promise.resolve({})
		let resolve
		if (options.resolve) {
			resolve = (infos) => {
				if (infos.type == this.DiffType.CREATE_ENTITY) {
					infos.verb = 'create'
				} else if (infos.type == this.DiffType.RENAME_ENTITY) {
					infos.verb = 'rename'
				}

				return options.resolve(infos).then((resolved) => {
					if (infos.type == this.DiffType.CREATE_ENTITY) {
						if (resolved.choice == 'change') {
							let action = {
								type: this.DiffType.DELETE_ENTITY,
								table: infos.local
							}
							return this.actions[action.type](action).then(() => {
								diff_undo = this.removeEntityHistory(diff_undo, infos.local, {target:'all'})
								return Promise.resolve(resolved)
							})
						}
						diff_undo = this.removeEntityHistory(diff_undo, infos.local, {target:'create'})
						return Promise.resolve(resolved)
					}
					return Promise.resolve(resolved)
				})
			}
		}
		for (let i in this.diff_redo) {
			p = p.then((action) => {
				console.log('pass-', action)
				if (action.type) {
					actions.push(action)
				}
				return this.redo({save: false, resolve: resolve}, context)
			})
		}

		p = p.then((action) => {
			if (action.type) {
				actions.push(action)
			}
			this.diff_redo = diff_redo
			this.diff = this.flatten(diff_undo, context)
			this.save()

			return Promise.resolve(actions)
		}).catch((e) => {
			this.diff_redo = diff_redo
			this.diff = diff_undo
			console.log('Error while updating, trying to revert', e.stack)
			console.log('with actions', actions)
			return this.revert(actions).then(() => {
				throw e
			})
		})

		return p
	}

	removeEntityHistory(diffs, entity, options) {
		options = options || {}
		let rw_diff = []
		console.log('removeEntityHistory', diffs, entity, options)
		for (let i in diffs) {
			let diff = diffs[i].redo
			if (diff.type == this.DiffType.CREATE_ENTITY
				&& this.context.getEntityBaseName(diff.table) == entity)
				continue
			if (options.target == 'all' && this.context.getEntityBaseName(diff.table) == entity)
				continue
			rw_diff.push(diffs[i])
		}
		return rw_diff
	}

	flatten(diffs, context) {
		let rw_diff = []
		for (let i in diffs) {
			let diff = diffs[i]
			if (diff.redo.type != this.DiffType.RENAME_ENTITY) {
				if (diff.redo.table) {
					diff.redo.table = this.context.getEntityName(this.context.getEntityBaseName(diff.redo.table))
				}
				if (diff.undo.table) {
					diff.undo.table = this.context.getEntityName(this.context.getEntityBaseName(diff.undo.table))
				}
				rw_diff.push(diff)
			}
		}
		for (let k in this.context.entities_map) {
			let v = this.context.entities_map[k]
			let fromTable = context ? context.getEntityName(k) : k
			if (v != fromTable)
			{
				rw_diff.push({
					undo: {
						type: this.DiffType.RENAME_ENTITY,
						table: v,
						value: fromTable
					},
					redo: {
						type: this.DiffType.RENAME_ENTITY,
						table: fromTable,
						value: v
					}
				})
			}
		}
		return rw_diff
	}
}

module.exports = History