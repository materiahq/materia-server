'use strict'

let fs = require('fs')

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

	undo(opts) {
		opts = opts || {history: false}
		if (this.diff.length == 0)
			return Promise.resolve({})
		let actionobj = this.diff.pop()
		this.diff_redo.push(actionobj)

		let action = this.actions[actionobj.undo.type]
		return action(actionobj.undo, opts).then(() => {
			this.save()
			return Promise.resolve(actionobj.undo)
		}).catch((err) => {
			this.save()
			throw err
		})
	}

	redo(opts) {
		opts = opts || {history: false}
		if (this.diff_redo.length == 0)
			return Promise.resolve({})
		let actionobj = this.diff_redo.pop()
		this.diff.push(actionobj)

		let action = this.actions[actionobj.redo.type]
		return action(actionobj.redo, opts).then(() => {
			this.save()
			return Promise.resolve(actionobj.redo)
		}).catch((err) => {
			this.save()
			throw err
		})
	}

	clear() {
		this.diff = []
		this.diff_redo = []
	}

	revert(diffs, opts) {
		let diff_redo = this.diff_redo
		let diff_undo = this.diff

		this.diff_redo = []
		this.diff = []
		if (diffs && diffs.length) {
			for (let diff of diffs) {
				this.diff.push(diff)
			}
		}

		let actions = []
		let p = Promise.resolve({})

		for (let i in this.diff) {
			p = p.then((action) => {
				if (action.type)
					actions.push(action)
				return this.undo(opts)
			})
		}

		p = p.then((action) => {
			if (action.type)
				actions.push(action)
			this.diff_redo = diff_redo
			this.diff = diff_undo
			return Promise.resolve(actions)
		}).catch((e) => {
			console.error('Could not revert', e.stack)
			this.diff_redo = diff_redo
			this.diff = diff_undo
			throw e
		})

		return p
	}

	apply(diffs, opts) {
		let diff_redo = this.diff_redo
		let diff_undo = this.diff

		this.diff_redo = []
		this.diff = []
		if (diffs && diffs.length) {
			for (let diff of diffs) {
				this.diff_redo.unshift(diff)
			}
		}

		let actions = []
		let p = Promise.resolve({})

		for (let i in this.diff_redo) {
			p = p.then((action) => {
				if (action.type) {
					actions.push(action)
				}
				return this.redo(opts)
			})
		}

		p = p.then((action) => {
			if (action.type) {
				actions.push(action)
			}
			this.diff_redo = diff_redo
			this.diff = diff_undo
			this.save()

			return Promise.resolve(actions)
		}).catch((e) => {
			this.diff_redo = diff_redo
			this.diff = diff_undo
			console.log('Error while updating', e.stack)
			throw e
		})

		return p
	}
}

module.exports = History