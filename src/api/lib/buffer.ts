
export function buffer(proc) {
	return new Promise((resolve, reject) => {
		let output = '';
		proc.stdout.on('data', data => {
			output += data;
		});
		proc.stderr.on('data', data => {
			output += data;
		});
		proc.on('close', code => {
			if (code == 0) {
				return resolve(output);
			}
			return reject({
				code: code,
				data: output
			});
		});
	});
}