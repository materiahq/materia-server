var fs = require('fs')

var ncp = require('ncp').ncp
var remove = require('remove')

module.exports = {
	cleanAppDir(appDir, callback) {
		try {
			if (fs.existsSync(appDir + '/entities') && fs.existsSync(appDir + '/tpl_entities'))
				remove.removeSync(appDir + '/entities')
			if (fs.existsSync(appDir + '/history'))
				remove.removeSync(appDir + '/history')
		} catch (err) {
			return callback(err)
		}
		ncp(appDir + '/tpl_entities', appDir + '/entities', (err) => {
			if (err)
				return callback(err)
			callback()
		})
	}
}