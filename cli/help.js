var pckg_info = require('../package.json')

module.exports = {
  index: () => {
    console.log(pckg_info.name + ' ' + pckg_info.version.yellow)
    console.log('')
    console.log('Available commands')
    console.log('    materia ' + 'init'.yellow + '\t\t\t\t\t' + 'Initializes a new Materia app')
    console.log('    materia ' + 'start'.yellow + '\t\t\t\t' + 'Starts a Materia app')
    console.log('    materia ' + 'addons'.yellow + ' <command> [arguments]' + '\t' + 'Manage addons')
    console.log('    materia ' + 'components'.yellow + ' <command> [arguments]' + '\t' + 'Manage components')
    console.log('    materia ' + 'templates'.yellow + ' <command> [arguments]' + '\t' + 'Manage templates')
    console.log('    materia ' + 'layouts'.yellow + ' <command> [arguments]' + '\t' + 'Manage layouts')
    console.log('    materia ' + 'entities'.yellow + ' <command> [arguments]' + '\t' + 'Manage entities')
    console.log('    materia ' + 'deploy'.yellow + ' <provider> [arguments]' + '\t' + 'Deploy a Materia app')
    console.log('')
    console.log('materia <command> ' + '--help'.green + ' for more information about a specific command')
	}
}
