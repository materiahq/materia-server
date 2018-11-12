const crlf = require('crlf');
const path = require('path');

if (process.platform === "win32") {
	return setFileEolToLF(path.join(__dirname, '..', 'cli', 'index.js'));
}

function setFileEolToLF(filepath) {
	crlf.set(filepath, 'LF', (err, endingType) => {
		if (err) {
			console.log(`Error converting ${filepath} end of line to LF : `, err);
		} else {
			console.log(`${filepath} end of line successfully converted from ${endingType} to LF`);
		}
	});
}