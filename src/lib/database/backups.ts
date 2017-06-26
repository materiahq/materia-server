import * as fs from 'fs'
import * as path from 'path'

import App from '../app'

export interface IBackup {
	started: boolean
	done?: boolean
	progress?: number
	current?: number
	total?: number
	callback: any
}

export class Backups {
	backupInfo: IBackup
	constructor(private app: App) {
		this.backupInfo = {
			started: false,
			callback: () => {}
		}
	}

	backup(callback: (progress:number) => void):Promise<any> {
		this.backupInfo = {
			started: true,
			progress: 0,
			current: 0,
			total: undefined,
			callback: callback
		}

		let now = new Date()
		this.app.logger.log('(Backup) Creating backup dev-001.json')
		let entities = []

		this.app.entities.findAll().forEach(entity => {
			let json = entity.toJson()
			json.name = entity.name
			entities.push(json)
		})

		return this._getTotalRows().then(total => {
			this.backupInfo.total = total
			return this._fetchAllData(entities)
		}).then(entities => {
			console.log(entities)
			let today = new Date()
			let dd = today.getDate();
			let mm = today.getMonth()+1; //January is 0!
			let yyyy = today.getFullYear();
			let h = today.getHours();
			let m = today.getMinutes();

			let backupFile = path.join(this.app.path, '.materia', 'backups', `${this.app.mode}_${mm}-${dd}-${yyyy}_${h}-${m}.json`)
			return this.app.saveFile(backupFile, JSON.stringify(entities, null, 2), {mkdir: true})
		}).then(()=> {
			this.backupInfo.done = true
			return true
		})
	}

	restore(backupData:any[], callback) {
		console.log(backupData)
	}

	restoreFile(file:string, callback) {
		let backupData = JSON.parse(fs.readFileSync(file, 'utf-8'))
		this.restore(backupData, callback)
	}


	private _fetchData(entity: any, data?: any[], page?:number) {
		if ( ! page) {
			page = 1
		}
		if ( ! data ) {
			data = []
		}
		console.log(`fetch ${entity.name} page ${page}`)
		let realEntity = this.app.entities.get(entity.name)
		return realEntity.getQuery('list').run({page: page, limit: 20}, {raw: true}).then(rows => {
			console.log(`retrieve ${rows.data.length} rows`)
			console.log(rows)
			if ( ! rows.data ) {
				return data
			}
			data = data.concat(rows.data)
			this.backupInfo.current += rows.data.length
			this.backupInfo.progress = this.backupInfo.current * 100 / this.backupInfo.total
			if (this.backupInfo.callback) {
				this.backupInfo.callback(this.backupInfo.progress)
			}
			console.log(data)
			if ( rows.data.length == 20) {
				return this._fetchData(entity, data, page + 1)
			}
			else {
				return data
			}
		})
	}


	private _fetchAllData(entities: any[], i?:number) {
		if ( ! i ) {
			i = 0
		}

		return this._fetchData(entities[i]).then(data => {
			console.log(`fetched data`, data)
			entities[i].data = data
			if ( i + 1 < entities.length ) {
				return this._fetchAllData(entities, i + 1)
			}
			else return entities
		})
	}

	private _getTotalRows(total?: number, i?: number) {
		if ( ! i ) {
			i = 0
		}
		if ( ! total ) {
			total = 0
		}
		let entities = this.app.entities.findAll()
		return entities[i].getQuery('list').run({limit: 1}).then(res => {
			total += res.count
			if (i + 1 < entities.length) {
				return this._getTotalRows(total, i + 1)
			}
			else {
				return total
			}
		})
	}
}