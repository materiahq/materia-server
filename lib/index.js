'use strict'

let fs = require('fs')

class History {
	constructor(app) {
		this.app = app
		this.actions = {}
		this.diff = []
		this.diff_redo = []
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
	}
	
	register(type, action) {
		this.actions[type] = action
	}
	
	undo() {
		return new Promise(function(accept, reject) {
			if (this.diff.length == 0)
				return reject()
			let actionobj = this.diff.pop()
			this.diff_redo.push(actionobj)
			let action = this.actions[actionobj.type]
			action.then(
				function() { accept(actionobj) },
				function(e) { reject(e) }
			)
		})
	}
	
	redo() {
		return new Promise(function(accept, reject) {
			if (this.diff_redo.length == 0)
				return reject()
			let actionobj = this.diff_redo.pop()
			this.diff.push(actionobj)
			let action = this.actions[actionobj.type]
			action().then(
				function() { accept(actionobj) },
				function(e) { reject(e) }
			)
		})
	}
	
	clear() {
		this.diff = []
		this.diff_redo = []
	}
	
	commit(hash) {
		fs.existsSync(this.app.path + '/history') || fs.mkdirSync(this.app.path + '/history');
		fs.writeFileSync(this.app.path + '/history/' + hash + '.json', JSON.stringify(this.diff, null, 2))
		this.diff = []
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
					for (let diff in diffs) {
						this.diff_redo.unshift(diff)
					} 
				}
			} catch(e) {
			}
		})
		
		let dolist = []
		for (let diff in this.diff_redo)
			dolist.push(() => { return this.redo() })
		
		let p = Promise.resolve()
		return dolist.reduce(function(pacc, fn) {
			return pacc.then(fn)
		}, p)
	}
}

module.exports = History