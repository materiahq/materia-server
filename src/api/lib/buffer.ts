
export function buffer(proc) {
	return new Promise((resolve, reject) => {
		let output = '';
		proc.stdout.on('data', data => {
			console.log(`stdout: ${data}`);
			output += data;
		});
		proc.stderr.on('data', data => {
			console.log(`stderr: ${data}`);
			output += data;
		});
		proc.on('close', code => {
			console.log(`npm exited with code ${code}`);
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