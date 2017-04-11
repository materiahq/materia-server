import * as cp from 'child_process'

import * as which from 'which'

export class Dependency {
	static check(cmd:string): Promise<any> {
		return new Promise((resolve, reject) => {
			which(cmd, (err, path) => {
				if (err) {
					return reject(err)
				}
				else {
					return resolve(path)
				}
			})
		})
	}
}