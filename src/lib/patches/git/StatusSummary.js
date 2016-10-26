let StatusSummary = require('simple-git/src/StatusSummary')

StatusSummary.parse = function (text) {
	var line, handler;

	var lines = text.trim().split('\n');
	var status = new StatusSummary();
	status.files = []

	while (line = lines.shift()) {
		line = line.match(/(..)\s+(.*)/);
		if (line) {
			if ((handler = StatusSummary.parsers[line[1].trim()])) {
				handler(line[2], status);
			}
			if (line[1] != '##') {
				let file_status = {
					path: line[2],
					index: line[1][0],
					working_dir: line[1][1]
				}
				if (line[1].trim() == 'R') {
					let detail = /^(.+) \-> (.+)$/.exec(line[2]) || [null, line[2], line[2]];
					file_status.path = detail[2]
					file_status.from = detail[1]
				}
				status.files.push(file_status)
			}
		}
	}

	return status;
};