'use strict';
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
//Not used yet... waiting for real support of these language
(function (SupportedLanguage) {
    SupportedLanguage[SupportedLanguage["JAVASCRIPT"] = 0] = "JAVASCRIPT";
    SupportedLanguage[SupportedLanguage["TYPESCRIPT"] = 1] = "TYPESCRIPT";
    SupportedLanguage[SupportedLanguage["COFFEESCRIPT"] = 2] = "COFFEESCRIPT";
})(exports.SupportedLanguage || (exports.SupportedLanguage = {}));
var SupportedLanguage = exports.SupportedLanguage;
/**
 * @class Addons
 * @classdesc
 * This class is used to manage your addons in a materia app.
 */
class Addons {
    constructor(app) {
        this.app = app;
        this.addons = [];
        this.addonsObj = {};
        this.rootDirectory = path.join(this.app.path, 'addons');
        this.addonsConfig = {};
    }
    /**
    Unload an addon by its name
    @returns void
    */
    unload(name) {
        this.addons.forEach((addon, i) => {
            if (addon.name == name) {
                this.addons.splice(i, 1);
            }
        });
    }
    _searchInstalledAddons() {
        return new Promise((resolve, reject) => {
            fs.readdir(path.join(this.app.path, 'addons'), (err, files) => {
                if (err && err.code == 'ENOENT') {
                    return resolve([]);
                }
                else if (err) {
                    return reject(err);
                }
                else if (files && files.length) {
                    let addons = [];
                    files.forEach(file => {
                        //add only directories
                        if (fs.lstatSync(path.join(this.app.path, 'addons', file)).isDirectory()) {
                            addons.push(file);
                        }
                    });
                    return resolve(addons);
                }
                else {
                    return resolve([]);
                }
            });
        });
    }
    _loadConfig() {
        return new Promise((resolve, reject) => {
            fs.exists(path.join(this.app.path, 'addons.json'), exists => {
                if (!exists) {
                    return resolve();
                }
                fs.readFile(path.join(this.app.path, 'addons.json'), 'utf8', (err, data) => {
                    if (err) {
                        return reject(err);
                    }
                    this.addonsConfig = JSON.parse(data);
                    return resolve(this.addonsConfig);
                });
            });
        });
    }
    /**
    Load all addons in the `addons/` directory
    @returns Promise<void>
    */
    load() {
        return this._loadConfig().then(config => {
            return this._searchInstalledAddons();
        }).then(addonsName => {
            return this._initializeAll(addonsName);
        }).then(addons => {
            this.addons = addons;
            let p = Promise.resolve();
            this.addons.forEach(addon => {
                p = p.then(() => {
                    console.log('addon', addon);
                    if (typeof addon.obj.load == 'function') {
                        let obj = addon.obj.load();
                        if (this._isPromise(obj)) {
                            return obj;
                        }
                    }
                    return Promise.resolve();
                }).then(() => {
                    return this._loadEntities(addon.name);
                }).then(() => {
                    return this._loadAPI(addon.name);
                });
            });
            return p;
        });
    }
    _checkName(name) {
        if (!name) {
            return Promise.reject(new Error('A name is required to create an addon.'));
        }
        let regexp = /[a-zA-Z0-9][.a-zA-Z0-9-_]*/g;
        if (!regexp.test(name)) {
            return Promise.reject(new Error('The addon name contains bad characters.'));
        }
        if (fs.exists(path.join(this.app.path, 'addons', name))) {
            return Promise.reject(new Error('The addon already exists: ' + name));
        }
    }
    create(name, description, options) {
        return this._checkName(name).then(() => {
            return new Promise((resolve, reject) => {
                mkdirp(path.join(this.app.path, 'addons', name), (err) => {
                    if (err) {
                        return reject(err);
                    }
                    let nameCapitalizeFirst = name.charAt(0).toUpperCase() + name.slice(1);
                    //TODO: Get Git name & email for the package.json
                    //TODO: Put these files in external template files (for readability)
                    let content = `'use strict';

class ${nameCapitalizeFirst} {
	constructor(app, config) {
		//TODO
	}

	start() {
		//TODO
		return Promise.resolve()
	}
}

module.exports = ${nameCapitalizeFirst};`;
                    let contentPackageJson = `{
  "author": {
    "name": "you@domain.com"
  },
  "dependencies": {
  },
  "description": ${JSON.stringify(description || '')},
  "devDependencies": {},
  "license": "MIT",
  "main": "index.js",
  "name": "${name}",
  "version": "0.1.0"
}`;
                    console.log('index.js created');
                    fs.writeFileSync(path.join(this.app.path, 'addons', name, 'index.js'), content);
                    fs.writeFileSync(path.join(this.app.path, 'addons', name, 'package.json'), contentPackageJson);
                    resolve();
                });
            });
        });
    }
    checkInstalled() {
        if (!this.app.infos.addons)
            return;
        let files;
        try {
            files = fs.readdirSync(path.join(this.app.path, 'addons'));
        }
        catch (e) {
            if (e.code == 'ENOENT') {
                if (Object.keys(this.app.infos.addons).length == 0)
                    return;
                throw new Error('Missing addons, please run "materia addons install"');
            }
            throw e;
        }
        for (let k in this.app.infos.addons) {
            let addon = /[^/]+$/.exec(k);
            addon = addon ? addon[0] : "";
            if (files.indexOf(addon) == -1) {
                throw new Error('Missing addon: ' + k + ', please run "materia addons install"');
            }
        }
    }
    start() {
        let p = Promise.resolve();
        this.addons.forEach(addon => {
            p = p.then(() => {
                if (typeof addon.obj.start == 'function') {
                    let startResult = addon.obj.start(addon.config);
                    if (this._isPromise(startResult)) {
                        return startResult;
                    }
                }
                return Promise.resolve();
            });
        });
        return p;
    }
    /**
    Get all the registered filters' name
    @returns {Array<object>}
    */
    findAll() { return this.addons; }
    /**
    Get a plugin object
    @param {string} - Addon's name
    @returns {object}
    */
    get(name) {
        let result;
        this.addons.forEach(addon => {
            if (addon.name == name) {
                result = addon;
            }
        });
        return result;
    }
    /**
    Get the registered addons count
    @returns {integer}
    */
    getLength() {
        return this.addons.length;
    }
    _loadEntities(addon) {
        return this.app.entities.loadFromAddon(addon);
    }
    _loadAPI(addon) {
        try {
            this.app.api.loadFromAddon(addon);
            return Promise.resolve();
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
    _initialize(addon) {
        if (this._hasIndexFile(addon)) {
            let AddonClass, addonInstance, addonPackage;
            try {
                addonPackage = require(path.join(this.rootDirectory, addon, 'package.json'));
                AddonClass = require(path.join(this.rootDirectory, addon));
            }
            catch (e) {
                let err = new Error('Impossible to require addon ' + addon);
                err.originalError = e;
                return Promise.reject(err);
            }
            try {
                addonInstance = new AddonClass(this.app, this.addonsConfig[addon], this.app.server.expressApp);
            }
            catch (e) {
                let err = new Error('Impossible to create addon ' + addon);
                err.originalError = e;
                return Promise.reject(err);
            }
            let version;
            if (addonPackage._from) {
                let matches = /^.*(?:#(.*))$/.exec(addonPackage._from);
                if (matches)
                    version = matches[1];
            }
            let config;
            try {
                config = require(path.join(this.rootDirectory, addon, 'install.json'));
            }
            catch (e) {
                console.log('Addon ' + addonPackage.name + ' not configured');
            }
            console.log('configuration file:', config);
            return Promise.resolve({
                name: addonPackage.name,
                path: path.join(this.rootDirectory, addon),
                info: {
                    description: addonPackage.description,
                    logo: addonPackage.materia && addonPackage.materia.logo,
                    author: addonPackage.materia && addonPackage.materia.author,
                    version: version
                },
                config: config,
                obj: addonInstance
            });
        }
        else {
            Promise.reject(new Error(''));
        }
    }
    _initializeAll(addons) {
        let promises = [];
        addons.forEach(addon => {
            promises.push(this._initialize(addon));
        });
        return Promise.all(promises);
    }
    _hasIndexFile(addon) {
        return fs.existsSync(path.join(this.rootDirectory, addon, 'index.coffee')) ||
            fs.existsSync(path.join(this.rootDirectory, addon, 'index.js')) ||
            fs.existsSync(path.join(this.rootDirectory, addon, 'index.ts')) ||
            fs.existsSync(path.join(this.rootDirectory, addon + '.js')) ||
            fs.existsSync(path.join(this.rootDirectory, addon + '.coffee')) ||
            fs.existsSync(path.join(this.rootDirectory, addon + '.ts'));
    }
    _isPromise(obj) {
        return obj && obj.then && obj.catch
            && typeof obj.then === 'function'
            && typeof obj.catch === 'function';
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Addons;
//# sourceMappingURL=addons.js.map