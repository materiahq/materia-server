const crlf = require('crlf');
const path = require('path');

if (process.platform === "win32") {
	return setFileEolToCRLF(path.join(__dirname, '..', 'cli', 'index.js'));
}

function setFileEolToCRLF(filepath) {
	crlf.set(filepath, 'CRLF', (err, endingType) => {
		if (err) {
			console.log(`Error converting ${filepath} end of line to CRLF : `, err);
		} else {
			console.log(`${filepath} end of line successfully converted from ${endingType} to CRLF`);
		}
	});
}