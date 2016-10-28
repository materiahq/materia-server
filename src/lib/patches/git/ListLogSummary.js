let Git = require('simple-git/src/git')
let ListLogSummary = require('simple-git/src/ListLogSummary')

Git.prototype.log = function (options, then) {
	var handler = Git.trailingFunctionArgument(arguments);
	var opt = (handler === then ? options : null) || {};

	var splitter = opt.splitter || ';';
	var format = opt.format || {
		hash: '%H',
		date: '%ai',
		message: '%s%d',
		author_name: '%aN',
		author_email: '%ae'
	};
	var fields = Object.keys(format);
	var formatstr = fields.map(function(k) { return format[k]; }).join(splitter);
	var command = ["log", "--all", "--pretty=format:" + formatstr];

	if (Array.isArray(opt)) {
		command = command.concat(opt);
		opt = {};
	}
	else if (typeof arguments[0] === "string" || typeof arguments[1] === "string") {
		this._getLog('warn',
		'Git#log: supplying to or from as strings is now deprecated, switch to an options configuration object');
		opt = {
		from: arguments[0],
		to: arguments[1]
		};
	}

	if (opt.from && opt.to) {
		command.push(opt.from + "..." + opt.to);
	}

	if (opt.file) {
		command.push("--follow", options.file);
	}

	if (opt.n || opt['max-count']) {
		command.push("--max-count=" + (opt.n || opt['max-count']));
	}

	'splitter n max-count file from to --pretty format'.split(' ').forEach(function (key) {
		delete opt[key];
	});

	Git._appendOptions(command, opt);

	return this._run(command, function (err, data) {
		handler && handler(err, !err && ListLogSummary.parse(data, splitter, fields));
	});
};

function ListLogLine (line, fields) {
	for (var k = 0; k < fields.length; k++) {
		this[fields[k]] = line[k];
	}
}

ListLogSummary.parse = function (text, splitter, fields) {
	fields = fields || ['hash', 'date', 'message', 'author_name', 'author_email'];
	return new ListLogSummary(
		text.split('\n').filter(Boolean).map(function (item) {
			return new ListLogLine(item.split(splitter), fields);
		})
	);
};