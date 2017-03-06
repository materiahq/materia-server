import * as cp from 'child_process'

export class Dependency {
	static check(cmd:string): Promise<any> {
		return new Promise((resolve, reject) => {
			let proc = cp.spawn(cmd, ['--version'])
			let out = ""
			let err = ""
			proc.stdout.on('data', data => {
				out += data.toString()
			})
			proc.stderr.on('data', data => {
				err += data.toString()
			})
			proc.on('close', code => {
				resolve()
			})
			proc.on('error', err => {
				reject()
			})
		})
	}
}