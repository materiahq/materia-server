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

	load() {
		try {
			let changes = fs.readFileSync(this.app.path + '/history/changes.json')
			this.diff = JSON.parse(changes.toString())
		} catch(e) {
			this.diff = []
		}
	}

	save() {
		fs.existsSync(this.app.path + '/history') || fs.mkdirSync(this.app.path + '/history');
		fs.writeFileSync(this.app.path + '/history/changes.json', JSON.stringify(this.diff, null, 2))
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

	undo() {
		return new Promise((accept, reject) => {
			if (this.diff.length == 0)
				return reject()
			let actionobj = this.diff.pop()
			this.diff_redo.push(actionobj)
			let action = this.actions[actionobj.undo.type]
			action(actionobj.undo).then(() => {
				this.save()
				return accept(actionobj.undo)
			}, (err) => {
				this.save()
				return reject(err)
			})
		})
	}

	redo() {
		return new Promise((accept, reject) => {
			if (this.diff_redo.length == 0)
				return reject()
			let actionobj = this.diff_redo.pop()
			this.diff.push(actionobj)
			let action = this.actions[actionobj.redo.type]
			action(actionobj.redo).then(() => {
				this.save()
				return accept(actionobj.redo)
			}, (err) => {
				this.save()
				return reject(err)
			})
		})
	}

	clear() {
		this.diff = []
		this.diff_redo = []
	}

	commit(hash) {
		fs.existsSync(this.app.path + '/history') || fs.mkdirSync(this.app.path + '/history');
		fs.writeFileSync(this.app.path + '/history/' + hash + '.json', JSON.stringify(this.diff, null, '\t'))
		this.diff = []
		return Promise.resolve()
	}

	revert() {
	}

	update(from) {
		let files
		try {
			files = fs.readdirSync(this.app.path + '/history')
		} catch (e) {
			if (e.code == 'ENOENT')
				return
			else
				throw e
		}
		files = files.sort((a,b) => { parseInt(a) > parseInt(b) })

		this.clear()
		files.forEach((file) => {
			let fileparse = /([0-9]+)\.json/.exec(file)
			if ( ! fileparse || parseInt(fileparse[1]) < from)
				return
			try {
				let changes = fs.readFileSync(this.app.path + '/history/' + file)
				let diffs = JSON.parse(changes.toString())
				if (diffs && diffs.length) {
					for (let diff of diffs) {
						this.diff_redo.unshift(diff)
					}
				}
			} catch(e) {
			}
		})

		let p = Promise.resolve([])
		for (let i in this.diff_redo) {
			p = p.then((actions) => {
				actions.push(this.redo().redo)
				return actions
			})
		}

		p = p.then((actions) => {
			this.clear()
			return actions
		})

		return p
	}
}

module.exports = History