import * as cp from 'child_process'

import * as which from 'which'

export class Dependency {
	static check(cmd:string): Promise<any> {
		return new Promise((resolve, reject) => {
			console.log(cmd, which);
			which(cmd, (err, path) => {
				console.log(err, path);
				if (err) {
					console.log('error', err)
					return reject(err)
				}
				else {
					console.log('resolve', path)
					return resolve(path)
				}
			})
		})
	}
}