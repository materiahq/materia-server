var fs = require('fs')

var ncp = require('ncp').ncp
var remove = require('remove')

function copyFile(source, target) {
	return new Promise(function(resolve, reject) {
		var rd = fs.createReadStream(source);
		rd.on('error', reject);
		var wr = fs.createWriteStream(target);
		wr.on('error', reject);
		wr.on('finish', resolve);
		rd.pipe(wr);
	});
}

exports.cleanAppDir = function cleanAppDir(appDir, callback) {
	exports.cleanHistory(appDir, (err) => {
		if (err)
			return callback(err)
		exports.cleanApi(appDir, (err) => {
			if (err)
				return callback(err)
			exports.cleanEntities(appDir, callback)
		})
	})
}

exports.cleanApi = function cleanApi(appDir, callback) {
	if (fs.existsSync(appDir + '/tpl_api.json')) {
		copyFile(appDir + '/tpl_api.json', appDir + '/api.json').then(() => {
			callback()
		}).catch((err) => {
			callback(err)
		})
	}
	else
		callback()
}

exports.cleanHistory = function cleanHistory(appDir, callback) {
	try {
		if (fs.existsSync(appDir + '/history'))
			remove.removeSync(appDir + '/history')
	} catch (err) {
		return callback(err)
	}
	callback()
}

exports.cleanEntities = function cleanEntities(appDir, callback) {
	try {
		if (fs.existsSync(appDir + '/entities') && fs.existsSync(appDir + '/tpl_entities')) {
			remove.removeSync(appDir + '/entities')
		}
	} catch (err) {
		return callback(err)
	}
	ncp(appDir + '/tpl_entities', appDir + '/entities', callback)
}